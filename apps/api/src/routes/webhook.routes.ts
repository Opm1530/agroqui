import { Router, Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { sendText } from '../services/evolution.service'
import { runAgent, extractInvoiceData, extractInvoiceDataFromText, classifyEntry, AgentMessage, InvoiceData } from '../services/ai.service'
import { uploadBuffer, buildKey } from '../services/s3.service'
import { downloadMedia } from '../services/evolution.service'
import { getSetting, SettingKeys } from '../services/settings.service'
import { lookupSupplier } from '../services/cnpj.service'
import { DocumentType, DocumentStatus, EntryCategory, EntryType, HarvestStatus, ProductUnit, StockMovementType } from '@prisma/client'
// pdf-parse v2 uses class-based API: new PDFParse({ data: buffer }).getText()
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require('pdf-parse') as { PDFParse: new (opts: { data: Buffer }) => { getText(): Promise<{ text: string }> } }

// ── WhatsApp number normalisation ────────────────────────────────────────────
// Brazil added a 9th digit to mobile numbers progressively from 2012.
// Evolution API may send either the 12-digit (old) or 13-digit (new) form.
// We generate both variants so the DB lookup always succeeds regardless of
// how the number was registered or how the carrier delivered it.
function buildWhatsappVariants(number: string): string[] {
  const digits = number.replace(/\D/g, '')
  const variants = new Set([digits])

  if (digits.startsWith('55')) {
    if (digits.length === 13) {
      // 55 + DDD(2) + 9 + XXXXXXXX(8) → also try without the leading 9
      // e.g. 5541999999999 → 554199999999
      const without9 = digits.slice(0, 4) + digits.slice(5)
      variants.add(without9)
    } else if (digits.length === 12) {
      // 55 + DDD(2) + XXXXXXXX(8) → also try with a leading 9
      // e.g. 554199999999 → 5541999999999
      const with9 = digits.slice(0, 4) + '9' + digits.slice(4)
      variants.add(with9)
    }
  }

  return [...variants]
}

const router = Router()

// Evolution API v2 webhook
router.post('/whatsapp', async (req: Request, res: Response) => {
  // Always respond 200 immediately so Evolution doesn't retry
  res.sendStatus(200)

  try {
    const payload = req.body

    // Evolution v2 event structure
    const event = payload?.event
    const data = payload?.data

    if (!event || !data) return

    // Only handle incoming messages
    if (event !== 'messages.upsert') return

    const message = data?.message
    if (!message) return

    // Ignore messages sent by us (fromMe)
    if (data?.key?.fromMe) return

    const from: string = data?.key?.remoteJid?.replace('@s.whatsapp.net', '') ?? ''
    if (!from) return

    // Build WhatsApp number variants to handle Brazil's 9th-digit ambiguity.
    // Some carriers/devices send 12-digit numbers (without 9), others send 13.
    // We try both so a producer registered with either format is always found.
    const fromVariants = buildWhatsappVariants(from)

    // Verify this number is registered in the system
    const producer = await prisma.producer.findFirst({
      where: { whatsapp: { in: fromVariants } },
      include: {
        user: { select: { name: true } },
        properties: {
          include: {
            harvests: {
              where: { status: { in: [HarvestStatus.ACTIVE, HarvestStatus.PLANNING] } },
            },
            plots: true,
          },
        },
      },
    })

    if (!producer) {
      // Unknown contact — ignore (or send onboarding message)
      await sendText(
        from,
        '👋 Olá! Para usar o Contador do Campo, você precisa ter uma conta ativa.\n\nAcesse nosso site para se cadastrar.'
      )
      return
    }

    // Check subscription is active
    const subscription = await prisma.subscription.findFirst({
      where: { producerId: producer.id, status: { in: ['ACTIVE', 'TRIALING', 'COMPLIMENTARY'] } },
      include: { plan: true },
    })

    if (!subscription) {
      await sendText(from, '⚠️ Sua assinatura está inativa. Acesse o painel para regularizar.')
      return
    }

    const plan = subscription.plan

    // Get or create agent session
    let session = await prisma.agentSession.findFirst({
      where: { producerId: producer.id },
      orderBy: { updatedAt: 'desc' },
    })

    const sessionMessages: AgentMessage[] = (session?.messages as unknown as AgentMessage[]) ?? []

    // Compute harvests and plots context
    const activeHarvests = producer.properties.flatMap((p) =>
      p.harvests.map((h) => ({ id: h.id, crop: h.crop, year: h.year, propertyName: p.name }))
    )
    const plots = producer.properties.flatMap((p) =>
      p.plots.map((pl) => ({ id: pl.id, name: pl.name }))
    )

    // Load products for activity matching
    const products = await prisma.product.findMany({
      where: { producerId: producer.id, isActive: true },
      select: { id: true, name: true, unit: true },
      orderBy: { name: 'asc' },
    })

    // ── Handle pending activity confirmation ──────────────────────────────────
    const pendingActivity = sessionMessages.find((m) => (m as any).role === 'pending_activity')
    if (pendingActivity) {
      const rawText = (message?.conversation ?? message?.extendedTextMessage?.text ?? '').trim().toLowerCase()
      const confirmed = ['sim', 's', '1', 'confirmar', 'confirma', 'ok', 'yes'].includes(rawText)
      const cancelled = ['não', 'nao', 'n', '2', 'cancelar', 'cancela', 'no'].includes(rawText)

      if (confirmed || cancelled) {
        if (confirmed) {
          await executeActivity(producer.id, JSON.parse(pendingActivity.content), from)
        } else {
          await sendText(from, '❌ Atividade cancelada.')
        }

        // Clear pending_activity from session
        const updatedMessages = sessionMessages
          .filter((m) => (m as any).role !== 'pending_activity')
          .slice(-40)
        if (session) {
          await prisma.agentSession.update({ where: { id: session.id }, data: { messages: updatedMessages as any } })
        }
        return
      }
    }

    // ── Determine message type ────────────────────────────────────────────────
    // Evolution API v2: instance name is at payload ROOT, not inside data
    const instanceName: string = payload?.instance ?? payload?.data?.instance ?? ''
    const messageId: string = data?.key?.id ?? ''
    const remoteJid: string = data?.key?.remoteJid ?? ''

    // Unwrap all possible document wrappers
    const docMsg =
      message?.documentMessage ??
      message?.documentWithCaptionMessage?.message?.documentMessage ??
      message?.viewOnceMessage?.message?.documentMessage ??
      message?.viewOnceMessageV2?.message?.documentMessage ??
      message?.viewOnceMessageV2Extension?.message?.documentMessage

    // Unwrap all possible image wrappers (including all view-once variants)
    const imgMsg =
      message?.imageMessage ??
      message?.viewOnceMessage?.message?.imageMessage ??
      message?.viewOnceMessageV2?.message?.imageMessage ??
      message?.viewOnceMessageV2Extension?.message?.imageMessage ??
      message?.ephemeralMessage?.message?.imageMessage

    const docMime: string = docMsg?.mimetype ?? ''
    const isDocImage = /image\/(jpeg|jpg|png|webp|gif)/i.test(docMime)
    const isDocPdf   = /pdf/i.test(docMime)

    // Detect view-once messages specifically (may fail to download — warn user)
    const isViewOnce = !!(
      message?.viewOnceMessage ||
      message?.viewOnceMessageV2 ||
      message?.viewOnceMessageV2Extension
    )

    const msgType = imgMsg                           ? 'image'
      : (docMsg && (isDocImage || isDocPdf))         ? 'document'
      : message?.conversation || message?.extendedTextMessage?.text ? 'text'
      : 'unknown'

    // Debug log — remove after confirming fix
    console.log('[webhook] msgType:', msgType, '| keys:', Object.keys(message).join(','), '| instance:', instanceName, '| msgId:', messageId)

    let userMessageText = ''
    let invoiceBuffer: Buffer | null = null
    let invoiceMime = 'image/jpeg'
    let pdfText: string | null = null

    if (msgType === 'text') {
      userMessageText = message.conversation ?? message.extendedTextMessage?.text ?? ''

    } else if (msgType === 'image' && plan.hasOcr) {
      if (!messageId) {
        await sendText(from, '❌ Não consegui identificar a imagem. Tente novamente.')
        return
      }
      try {
        invoiceBuffer = await downloadMedia(instanceName, messageId, remoteJid)
        invoiceMime = imgMsg?.mimetype ?? 'image/jpeg'
        userMessageText = '[Invoice image received - processing OCR]'
      } catch (err) {
        console.error('[webhook] image download failed:', err)
        if (isViewOnce) {
          await sendText(
            from,
            '⚠️ Fotos de *visualização única* não podem ser lidas.\n\n' +
            'Por favor, envie a foto da nota fiscal de forma normal (sem a opção "visualização única").'
          )
        } else {
          await sendText(from, '❌ Não consegui baixar a imagem. Tente novamente.')
        }
        return
      }

    } else if (msgType === 'document' && plan.hasOcr) {
      if (!messageId) {
        await sendText(from, '❌ Não consegui identificar o arquivo. Tente enviar novamente.')
        return
      }
      try {
        const fileBuffer = await downloadMedia(instanceName, messageId, remoteJid)
        if (isDocImage) {
          invoiceBuffer = fileBuffer
          invoiceMime = docMime
          userMessageText = '[Invoice image received - processing OCR]'
        } else {
          await sendText(from, '📄 Processando PDF...')
          const parser = new PDFParse({ data: fileBuffer })
          const parsed = await parser.getText()
          const extracted = (parsed.text ?? '').trim()
          if (extracted.length < 50) {
            await sendText(from, '⚠️ Não consegui extrair texto deste PDF. Tente enviar uma foto da nota.')
            return
          }
          pdfText = extracted
          userMessageText = '[Invoice PDF received - processing OCR]'
        }
      } catch (err) {
        console.error('[webhook] document download/parse error:', err)
        await sendText(from, '❌ Não consegui processar o arquivo. Tente novamente.')
        return
      }

    } else if ((msgType === 'image' || msgType === 'document') && !plan.hasOcr) {
      await sendText(from, '📸 O envio de fotos/arquivos de notas fiscais está disponível no plano Pro.')
      return

    } else {
      // Unknown type — log payload for debugging
      console.log('[webhook] unknown message type — full message keys:', JSON.stringify(Object.keys(message)))
      await sendText(from, '❓ Não consigo processar esse tipo de mensagem. Envie texto, foto ou PDF da nota fiscal.')
      return
    }

    // Handle commands
    if (userMessageText.startsWith('/relatorio')) {
      await handleReportCommand(from, producer.id, plan)
      return
    }
    if (userMessageText.startsWith('/saldo')) {
      await handleBalanceCommand(from, producer.id)
      return
    }
    if (userMessageText.startsWith('/safra')) {
      await handleHarvestsCommand(from, producer.id)
      return
    }
    if (userMessageText.startsWith('/ajuda')) {
      await sendText(
        from,
        `🌾 *Contador do Campo — Ajuda*\n\n` +
        `📸 Mande foto da nota fiscal para registrar\n` +
        `💬 Pergunte em linguagem natural\n\n` +
        `*Comandos:*\n` +
        `/relatorio — Gerar DRE da safra\n` +
        `/saldo — Ver saldo do caixa\n` +
        `/safra — Listar safras ativas\n` +
        `/ajuda — Esta mensagem`
      )
      return
    }

    // Process OCR if image or PDF
    if ((invoiceBuffer || pdfText) && plan.hasOcr) {
      if (invoiceBuffer) await sendText(from, '🔍 Processando a nota fiscal...')

      try {
        const invoiceData = pdfText
          ? await extractInvoiceDataFromText(pdfText)
          : await extractInvoiceData(invoiceBuffer as Buffer, invoiceMime)

        // Upload to S3 — optional (skipped if AWS not configured in dev)
        const s3Key = buildKey(producer.id, 'invoices', `${Date.now()}.jpg`)
        let s3Url: string | null = null
        try {
          s3Url = invoiceBuffer ? await uploadBuffer(invoiceBuffer, s3Key, invoiceMime) : null
        } catch (s3Err) {
          console.warn('[webhook] S3 upload failed (non-critical):', s3Err)
        }

        // Save document
        const document = await prisma.document.create({
          data: {
            producerId: producer.id,
            type: DocumentType.INVOICE_PHOTO,
            s3Key,
            s3Url: s3Url ?? '',
            ocrText: invoiceData.rawText,
            ocrData: invoiceData as any,
            status: DocumentStatus.OCR_DONE,
          },
        })

        // ── Populate price index from invoice items ──────────────────────
        const locationProperty = producer.properties[0]
        if (locationProperty?.state && invoiceData.items?.length) {
          // Enrich supplier name/location via CNPJ lookup (non-blocking, best-effort)
          let supplierDisplayName = invoiceData.supplier ?? null
          let supplierCity = locationProperty.city ?? null
          let supplierState = locationProperty.state!

          if (invoiceData.supplierCnpj) {
            const supplierInfo = await lookupSupplier(invoiceData.supplierCnpj).catch(() => null)
            if (supplierInfo) {
              supplierDisplayName = supplierInfo.displayName
              if (supplierInfo.city) supplierCity = supplierInfo.city
              if (supplierInfo.state) supplierState = supplierInfo.state
            }
          }

          const priceEntries = invoiceData.items
            .filter((item) => item.unitPrice && item.unitPrice > 0 && item.product)
            .map((item) => ({
              product: item.product!,
              category: EntryCategory.OTHER_EXPENSE,
              city: supplierCity,
              state: supplierState,
              pricePerUnit: item.unitPrice!,
              unit: item.unit ?? null,
              quantity: item.quantity ?? null,
              totalAmount: item.value,
              supplier: supplierDisplayName,
              supplierCnpj: invoiceData.supplierCnpj ?? null,
              documentId: document.id,
              date: invoiceData.date ? new Date(invoiceData.date) : new Date(),
            }))
          if (priceEntries.length > 0) {
            await prisma.priceIndex.createMany({ data: priceEntries }).catch(() => {/* non-critical */})
          }
        }

        // Suggest category — pass NCM codes for deterministic classification first
        const ncmCodes = invoiceData.items?.map((i) => i.ncm ?? '').filter(Boolean)
        const category = await classifyEntry(
          invoiceData.rawText ?? invoiceData.items?.map((i) => i.description).join(', ') ?? '',
          invoiceData.supplier,
          ncmCodes
        )

        // ── Add invoice items to stock ────────────────────────────────────
        const property = producer.properties[0]
        const stockResults = await addInvoiceToStock(producer.id, property?.id ?? '', invoiceData, document.id)

        const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        const itemLines = stockResults.length
          ? stockResults.map((r) => `• ${r.name}: ${r.qty} ${r.unit}`).join('\n')
          : `• ${invoiceData.rawText ?? 'Item sem descrição'}`

        await sendText(
          from,
          `✅ *Nota fiscal adicionada ao estoque!*\n\n` +
          (invoiceData.supplier ? `🏪 ${invoiceData.supplier}\n` : '') +
          `💵 Total: ${fmt(invoiceData.amount ?? 0)}\n` +
          (invoiceData.date ? `📅 ${invoiceData.date}\n` : '') +
          `\n*Itens no estoque:*\n${itemLines}\n\n` +
          `_Para usar estes itens em uma safra, registre uma atividade no painel._`
        )
        return
      } catch (ocrErr) {
        console.error('[webhook] OCR processing failed:', ocrErr)
        await sendText(
          from,
          '❌ Não consegui ler a nota fiscal.\n\n' +
          '💡 *Dicas para melhorar o resultado:*\n' +
          '• Tire a foto com boa iluminação\n' +
          '• Evite sombras ou reflexos sobre o texto\n' +
          '• Certifique-se que o texto está nítido e reto\n\n' +
          '_Tente enviar a foto novamente ou envie um PDF._'
        )
        return
      }
    }

    // Run AI agent
    const { reply: agentReply, action } = await runAgent(
      sessionMessages,
      { producerName: producer.user.name, whatsapp: from, activeHarvests, plots, products },
      userMessageText
    )

    // Execute action and get real confirmation message (overrides agent reply when applicable)
    let finalReply = agentReply
    let pendingActivityData: any = null

    if (action) {
      if (action.type === 'PROPOSE_ACTIVITY') {
        // Store proposal in session — wait for user confirmation
        pendingActivityData = action.data
        // finalReply comes from agent (already contains the confirmation prompt)
      } else {
        const actionMessage = await handleAgentAction(action, producer.id, from)
        if (actionMessage) finalReply = actionMessage
      }
    }

    // Update session — include pending_activity if agent proposed one
    const baseMessages = [
      ...sessionMessages.filter((m) => (m as any).role !== 'pending_activity'),
      { role: 'user' as const, content: userMessageText },
      { role: 'assistant' as const, content: finalReply },
    ]
    const updatedMessages = [
      ...baseMessages,
      ...(pendingActivityData
        ? [{ role: 'pending_activity' as any, content: JSON.stringify(pendingActivityData) }]
        : []),
    ].slice(-40)

    if (session) {
      await prisma.agentSession.update({
        where: { id: session.id },
        data: { messages: updatedMessages as any },
      })
    } else {
      await prisma.agentSession.create({
        data: { producerId: producer.id, messages: updatedMessages as any },
      })
    }

    await sendText(from, finalReply)
  } catch (err) {
    console.error('Webhook error:', err)
  }
})

// ── Execute confirmed activity ────────────────────────────────────────────────
async function executeActivity(producerId: string, data: any, from: string): Promise<void> {
  try {
    const { ActivityType } = await import('@prisma/client')

    const harvest = await prisma.harvest.findFirst({
      where: { id: data.harvestId, property: { producerId } },
      include: { property: { select: { id: true, name: true } } },
    })
    if (!harvest) {
      await sendText(from, '⚠️ Safra não encontrada. Atividade não registrada.')
      return
    }

    const activityType = ActivityType[data.activityType as keyof typeof ActivityType] ?? ActivityType.OTHER
    const entryDate = data.date ? new Date(data.date) : new Date()

    const activity = await prisma.activity.create({
      data: {
        harvestId: harvest.id,
        plotId: data.plotId ?? null,
        type: activityType,
        date: entryDate,
        hectares: data.hectares ?? null,
        notes: data.notes ?? null,
        items: data.items?.length
          ? {
              create: data.items.map((item: any) => ({
                productId: item.productId,
                quantity: item.quantity,
                unit: ProductUnit[item.unit as keyof typeof ProductUnit] ?? ProductUnit.UNIDADE,
              })),
            }
          : undefined,
      },
      include: { items: { include: { product: true } } },
    })

    // Give stock OUT movements for each item
    for (const item of activity.items) {
      const stockItem = await prisma.stockItem.findFirst({
        where: { producerId, productId: item.productId, propertyId: harvest.property.id },
      })
      if (stockItem) {
        await prisma.stockMovement.create({
          data: {
            stockItemId: stockItem.id,
            type: StockMovementType.OUT,
            quantity: item.quantity,
            date: entryDate,
            note: `Atividade WhatsApp: ${data.activityType}`,
            activityId: activity.id,
          },
        })
        await prisma.stockItem.update({
          where: { id: stockItem.id },
          data: { quantity: { decrement: item.quantity } },
        })
      }
    }

    const typeLabels: Record<string, string> = {
      PLANTING: '🌱 Plantio', APPLICATION: '🌿 Aplicação',
      FUELING: '⛽ Abastecimento', HARVEST_OP: '🌾 Colheita', OTHER: '📋 Outro',
    }
    const unitLabels: Record<string, string> = {
      LITER: 'L', KG: 'kg', SACA_60KG: 'sc 60kg', TONELADA: 't', UNIDADE: 'un',
    }

    const itemLines = activity.items
      .map((it) => `• ${it.product.name}: ${it.quantity} ${unitLabels[it.unit] ?? it.unit}`)
      .join('\n')

    await sendText(
      from,
      `✅ *Atividade registrada!*\n\n` +
      `${typeLabels[data.activityType] ?? data.activityType}\n` +
      `🌾 ${harvest.crop} ${harvest.year}\n` +
      `📅 ${entryDate.toLocaleDateString('pt-BR')}\n` +
      (data.hectares ? `📐 ${data.hectares} ha\n` : '') +
      (itemLines ? `\n*Produtos usados:*\n${itemLines}\n` : '') +
      `\n_Visualize no painel em /dashboard/activities_`
    )
  } catch (err) {
    console.error('executeActivity error:', err)
    await sendText(from, '❌ Erro ao registrar a atividade. Tente novamente.')
  }
}

// ── Map invoice unit string to ProductUnit enum ───────────────────────────────
function toProductUnit(unit?: string): ProductUnit {
  switch ((unit ?? '').toLowerCase()) {
    case 'l': case 'liter': case 'litro': case 'litros': return ProductUnit.LITER
    case 'kg': return ProductUnit.KG
    case 'sc60kg': case 'saca': case 'sacas': return ProductUnit.SACA_60KG
    case 't': case 'ton': case 'tonelada': return ProductUnit.TONELADA
    default: return ProductUnit.UNIDADE
  }
}

// ── Add invoice items to stock (new primary OCR flow) ────────────────────────
async function addInvoiceToStock(
  producerId: string,
  propertyId: string,
  invoiceData: InvoiceData,
  documentId: string
): Promise<Array<{ name: string; qty: number; unit: string }>> {
  const results: Array<{ name: string; qty: number; unit: string }> = []
  const date = invoiceData.date ? new Date(invoiceData.date) : new Date()

  const items = invoiceData.items?.filter((i) => i.product || i.description) ?? []

  if (!items.length) {
    // No line items — create a single generic stock entry using rawText
    const name = invoiceData.rawText ?? 'Item sem descrição'
    const ncm = undefined
    const category = await classifyEntry(name, invoiceData.supplier).catch(() => EntryCategory.OTHER_EXPENSE)
    const unit = ProductUnit.UNIDADE

    const product = await prisma.product.upsert({
      where: { producerId_name: { producerId, name } } as any,
      update: {},
      create: { producerId, name, unit, category, isActive: true },
    }).catch(() => prisma.product.findFirst({ where: { producerId, name } }))

    if (product && propertyId) {
      const stockItem = await prisma.stockItem.upsert({
        where: { producerId_productId_propertyId: { producerId, productId: product.id, propertyId } },
        update: { quantity: { increment: 1 } },
        create: { producerId, productId: product.id, propertyId, quantity: 1 },
      })
      await prisma.stockMovement.create({
        data: { stockItemId: stockItem.id, type: StockMovementType.IN, quantity: 1, unitCost: invoiceData.amount ?? null, date, note: `NF WhatsApp: ${invoiceData.supplier ?? ''}`, entryId: null },
      })
    }
    results.push({ name, qty: 1, unit: 'unid' })
    return results
  }

  for (const item of items) {
    const name = item.product ?? item.description ?? 'Produto'
    const qty = item.quantity ?? 1
    const unit = toProductUnit(item.unit)
    const category = await classifyEntry(item.description ?? name, invoiceData.supplier).catch(() => EntryCategory.OTHER_EXPENSE)

    // Find or create product for this producer
    let product = await prisma.product.findFirst({ where: { producerId, name } })
    if (!product) {
      product = await prisma.product.create({ data: { producerId, name, unit, category, isActive: true } })
    }

    if (!propertyId) {
      results.push({ name, qty, unit: item.unit ?? 'unid' })
      continue
    }

    // Upsert stock item and add IN movement
    const stockItem = await prisma.stockItem.upsert({
      where: { producerId_productId_propertyId: { producerId, productId: product.id, propertyId } },
      update: { quantity: { increment: qty } },
      create: { producerId, productId: product.id, propertyId, quantity: qty },
    })

    await prisma.stockMovement.create({
      data: {
        stockItemId: stockItem.id,
        type: StockMovementType.IN,
        quantity: qty,
        unitCost: item.unitPrice ?? null,
        date,
        note: `NF WhatsApp: ${invoiceData.supplier ?? ''}`,
        entryId: null,
      },
    })

    results.push({ name, qty, unit: item.unit ?? 'unid' })
  }

  return results
}

// Returns a confirmation string to replace the agent's reply, or null to keep the agent reply
async function handleAgentAction(action: any, producerId: string, from: string): Promise<string | null> {
  try {
    // ── REGISTER_ENTRY ────────────────────────────────────────────────────────
    if (action.type === 'REGISTER_ENTRY') {
      const d = action.data
      const category = EntryCategory[d.category as keyof typeof EntryCategory] ?? EntryCategory.OTHER_EXPENSE
      const isIncome = (category as string === EntryCategory.PRODUCTION_SALE || category as string === EntryCategory.OTHER_INCOME)

      // Validate harvestId — must belong to this producer
      let harvestId = d.harvestId
      let harvestName = ''
      if (harvestId) {
        const harvest = await prisma.harvest.findFirst({
          where: { id: harvestId, property: { producerId } },
          include: { property: { select: { name: true } } },
        })
        if (harvest) {
          harvestName = `${harvest.crop} ${harvest.year}`
        } else {
          harvestId = null
        }
      }

      // Fallback to most recent active harvest
      if (!harvestId) {
        const fallback = await prisma.harvest.findFirst({
          where: { property: { producerId }, status: { in: [HarvestStatus.ACTIVE, HarvestStatus.PLANNING] } },
          orderBy: { createdAt: 'desc' },
          include: { property: { select: { name: true } } },
        })
        if (!fallback) {
          return '⚠️ Não encontrei uma safra ativa. Cadastre uma safra no painel antes de registrar lançamentos.'
        }
        harvestId = fallback.id
        harvestName = `${fallback.crop} ${fallback.year}`
      }

      // Validate plotId (empty string → null)
      let plotId: string | null = d.plotId && String(d.plotId).trim() ? d.plotId : null
      if (plotId) {
        const plot = await prisma.plot.findFirst({ where: { id: plotId, property: { producerId } } })
        if (!plot) plotId = null
      }

      // Parse date safely
      const parsedDate = d.date ? new Date(d.date) : null
      const entryDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : new Date()

      const amount = Number(d.amount) || 0

      await prisma.entry.create({
        data: {
          harvestId,
          plotId,
          category,
          type: isIncome ? EntryType.INCOME : EntryType.EXPENSE,
          amount,
          date: entryDate,
          supplier: d.supplier ?? null,
          description: d.description ?? null,
        },
      })

      // Real confirmation with actual data
      const categoryLabels: Record<string, string> = {
        FUEL: '⛽ Combustível', FERTILIZER: '🪨 Adubo', DEFENSIVE: '🌿 Defensivo',
        SEED: '🌱 Semente', MACHINERY_MAINTENANCE: '🔧 Manutenção', LABOR: '👷 Mão de Obra',
        LEASE: '🏡 Arrendamento', FREIGHT_DRYING: '🚛 Frete/Secagem',
        PRODUCTION_SALE: '💰 Venda', OTHER_INCOME: '📈 Receita', OTHER_EXPENSE: '📋 Despesa',
      }
      return (
        `✅ *Lançamento registrado!*\n\n` +
        `📂 ${categoryLabels[category] ?? category}\n` +
        `💵 ${isIncome ? '+' : '-'} R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
        `📅 ${entryDate.toLocaleDateString('pt-BR')}\n` +
        (d.supplier ? `🏪 ${d.supplier}\n` : '') +
        (d.description ? `📝 ${d.description}\n` : '') +
        `🌾 Safra: ${harvestName}\n\n` +
        `_Visualize no painel: /dashboard/entries_`
      )
    }

    // ── GENERATE_REPORT ───────────────────────────────────────────────────────
    if (action.type === 'GENERATE_REPORT') {
      let harvestId = action.harvestId

      // Validate or fallback
      if (harvestId) {
        const h = await prisma.harvest.findFirst({ where: { id: harvestId, property: { producerId } } })
        if (!h) harvestId = null
      }
      if (!harvestId) {
        const fallback = await prisma.harvest.findFirst({
          where: { property: { producerId }, status: { in: [HarvestStatus.ACTIVE, HarvestStatus.PLANNING] } },
          orderBy: { createdAt: 'desc' },
        })
        if (!fallback) return '⚠️ Nenhuma safra ativa encontrada.'
        harvestId = fallback.id
      }

      const harvest = await prisma.harvest.findUnique({
        where: { id: harvestId },
        include: { property: true, entries: true },
      })
      if (!harvest) return '⚠️ Safra não encontrada.'

      const income = harvest.entries.filter((e) => e.type === EntryType.INCOME).reduce((s, e) => s + e.amount, 0)
      const expense = harvest.entries.filter((e) => e.type === EntryType.EXPENSE).reduce((s, e) => s + e.amount, 0)
      const net = income - expense
      const hectares = harvest.property.hectares ?? 1
      const costPerHa = expense / hectares
      const margin = income > 0 ? ((net / income) * 100).toFixed(1) : '0'

      // Group expenses by category
      const byCategory: Record<string, number> = {}
      for (const e of harvest.entries.filter((e) => e.type === EntryType.EXPENSE)) {
        byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount
      }

      const categoryNames: Record<string, string> = {
        FUEL: '⛽ Combustível', FERTILIZER: '🪨 Adubo', DEFENSIVE: '🌿 Defensivo',
        SEED: '🌱 Semente', MACHINERY_MAINTENANCE: '🔧 Manutenção', LABOR: '👷 Mão de Obra',
        LEASE: '🏡 Arrendamento', FREIGHT_DRYING: '🚛 Frete/Secagem', OTHER_EXPENSE: '📋 Outros',
      }

      const categoryLines = Object.entries(byCategory)
        .sort(([, a], [, b]) => b - a)
        .map(([cat, val]) => `  ${categoryNames[cat] ?? cat}: R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
        .join('\n')

      const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

      return (
        `📊 *DRE — ${harvest.crop} ${harvest.year}*\n` +
        `📍 ${harvest.property.name}\n\n` +
        `✅ Receitas:  ${fmt(income)}\n` +
        `❌ Despesas: ${fmt(expense)}\n` +
        `${net >= 0 ? '💰' : '🔴'} Resultado: ${fmt(net)}\n` +
        `📐 Custo/ha: ${fmt(costPerHa)}\n` +
        `📈 Margem:   ${margin}%\n\n` +
        `*Por categoria:*\n${categoryLines || '  Nenhuma despesa registrada'}\n\n` +
        `_Relatório completo no painel web_`
      )
    }

    return null
  } catch (err) {
    console.error('Action error:', err)
    return null
  }
}

async function handleReportCommand(from: string, producerId: string, plan: any) {
  if (!plan.hasAutoDre) {
    await sendText(from, '📊 A geração de DRE automático está disponível no plano Pro.\n\nAcesse o painel para fazer upgrade.')
    return
  }
  await sendText(from, '📊 Gerando seu relatório DRE... Acesse o painel para visualizar o relatório completo.')
}

async function handleBalanceCommand(from: string, producerId: string) {
  const entries = await prisma.entry.findMany({
    where: { harvest: { property: { producerId } } },
    select: { type: true, amount: true },
  })
  const income = entries.filter((e) => e.type === EntryType.INCOME).reduce((s, e) => s + e.amount, 0)
  const expense = entries.filter((e) => e.type === EntryType.EXPENSE).reduce((s, e) => s + e.amount, 0)
  const balance = income - expense

  await sendText(
    from,
    `💰 *Saldo Geral*\n\n` +
    `✅ Receitas: R$ ${income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
    `❌ Despesas: R$ ${expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
    `📊 Saldo: R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  )
}

async function handleHarvestsCommand(from: string, producerId: string) {
  const harvests = await prisma.harvest.findMany({
    where: { property: { producerId }, status: { in: [HarvestStatus.ACTIVE, HarvestStatus.PLANNING] } },
    include: { property: { select: { name: true } } },
  })

  if (!harvests.length) {
    await sendText(from, '🌱 Nenhuma safra ativa encontrada. Cadastre uma pelo painel.')
    return
  }

  const list = harvests.map((h) => `• ${h.crop} ${h.year} — ${h.property.name} (${h.status})`).join('\n')
  await sendText(from, `🌾 *Safras Ativas*\n\n${list}`)
}

export default router
