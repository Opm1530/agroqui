import { Router, Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { sendText } from '../services/evolution.service'
import { runAgent, extractInvoiceData, extractInvoiceDataFromText, classifyEntry, AgentMessage, InvoiceData } from '../services/ai.service'
import { uploadBuffer, buildKey } from '../services/s3.service'
import { downloadMedia } from '../services/evolution.service'
import { getSetting, SettingKeys } from '../services/settings.service'
import { lookupSupplier } from '../services/cnpj.service'
import { DocumentType, DocumentStatus, EntryCategory, EntryType, HarvestStatus } from '@prisma/client'
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

// ── Pending invoice stored in session messages ────────────────────────────────
// role: 'pending_invoice', content: JSON string of PendingInvoice
interface PendingInvoice {
  amount: number
  supplier?: string | null
  date?: string | null
  category: string
  description?: string | null
  documentId: string
  plotId?: string | null
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

    // ── Detect interactive button / list responses ────────────────────────────
    const selectedId: string | undefined =
      message?.buttonsResponseMessage?.selectedButtonId ??
      message?.listResponseMessage?.singleSelectReply?.selectedRowId

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

    // Compute harvests and plots context (needed for OCR flow and button handler)
    const activeHarvests = producer.properties.flatMap((p) =>
      p.harvests.map((h) => ({ id: h.id, crop: h.crop, year: h.year, propertyName: p.name }))
    )
    const plots = producer.properties.flatMap((p) =>
      p.plots.map((pl) => ({ id: pl.id, name: pl.name }))
    )

    // ── Handle harvest-selection via interactive button (legacy) ─────────────
    if (selectedId?.startsWith('HARVEST_')) {
      const harvestId = selectedId.replace('HARVEST_', '')
      await handleHarvestSelected(from, producer.id, harvestId, session, sessionMessages)
      return
    }

    // ── Handle harvest-selection via numbered text reply ──────────────────────
    const pendingInSession = sessionMessages.find((m) => (m as any).role === 'pending_invoice')
    if (pendingInSession) {
      const rawText = (message?.conversation ?? message?.extendedTextMessage?.text ?? '').trim()
      const choiceNum = parseInt(rawText, 10)
      if (!isNaN(choiceNum) && choiceNum >= 1) {
        // User replied with a number to select harvest
        const harvestIdx = choiceNum - 1
        if (harvestIdx < activeHarvests.length) {
          await handleHarvestSelected(from, producer.id, activeHarvests[harvestIdx].id, session, sessionMessages)
        } else {
          await sendText(from, `⚠️ Opção inválida. Responda com um número entre 1 e ${activeHarvests.length}.`)
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

        // ── Ask producer which harvest this invoice belongs to ───────────
        if (activeHarvests.length > 1) {
          // Store pending invoice in session
          const pending: PendingInvoice = {
            amount: invoiceData.amount ?? 0,
            supplier: invoiceData.supplier ?? null,
            date: invoiceData.date ?? null,
            category,
            description: invoiceData.items?.map((i) => i.description).join(', ') ?? null,
            documentId: document.id,
            plotId: null,
          }

          const updatedMessages: AgentMessage[] = [
            ...sessionMessages.filter((m) => (m as any).role !== 'pending_invoice'),
            { role: 'pending_invoice' as any, content: JSON.stringify(pending) },
          ].slice(-40)

          if (session) {
            await prisma.agentSession.update({ where: { id: session.id }, data: { messages: updatedMessages as any } })
          } else {
            await prisma.agentSession.create({ data: { producerId: producer.id, messages: updatedMessages as any } })
          }

          // Format invoice summary for the question
          const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          const invoiceSummary =
            `📄 *Nota fiscal processada*\n` +
            (invoiceData.supplier ? `🏪 Fornecedor: ${invoiceData.supplier}\n` : '') +
            `💵 Valor: ${fmt(invoiceData.amount ?? 0)}\n` +
            (invoiceData.date ? `📅 Data: ${invoiceData.date}\n` : '') +
            `\n*Para qual safra devo registrar?*`

          // Send numbered list — works on all WhatsApp clients (Web, phone, etc.)
          const harvestList = activeHarvests
            .map((h, i) => `${i + 1}️⃣ ${h.crop} ${h.year} — ${h.propertyName}`)
            .join('\n')
          await sendText(from, `${invoiceSummary}\n\n${harvestList}\n\n_Responda com o número da safra._`)
          return
        }

        // Single harvest — continue to agent as before
        userMessageText = `[OCR Result: Supplier: ${invoiceData.supplier ?? 'unknown'}, Amount: R$${invoiceData.amount ?? 0}, Date: ${invoiceData.date ?? 'unknown'}, Items: ${invoiceData.rawText ?? ''}, Suggested category: ${category}]`
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
      { producerName: producer.user.name, whatsapp: from, activeHarvests, plots },
      userMessageText
    )

    // Execute action and get real confirmation message (overrides agent reply when applicable)
    let finalReply = agentReply
    if (action) {
      const actionMessage = await handleAgentAction(action, producer.id, from)
      if (actionMessage) finalReply = actionMessage
    }

    // Update session
    const updatedMessages = [
      ...sessionMessages,
      { role: 'user' as const, content: userMessageText },
      { role: 'assistant' as const, content: finalReply },
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

// ── Handle harvest selected via WhatsApp button / list ────────────────────────
async function handleHarvestSelected(
  from: string,
  producerId: string,
  harvestId: string,
  session: any,
  sessionMessages: AgentMessage[]
): Promise<void> {
  try {
    // Retrieve pending invoice from session
    const pendingMsg = sessionMessages.find((m) => (m as any).role === 'pending_invoice')
    if (!pendingMsg) {
      await sendText(from, '⚠️ Não encontrei uma nota fiscal pendente. Envie a foto novamente.')
      return
    }

    const pending: PendingInvoice = JSON.parse(pendingMsg.content)

    // Validate harvest belongs to this producer
    const harvest = await prisma.harvest.findFirst({
      where: { id: harvestId, property: { producerId } },
      include: { property: { select: { name: true } } },
    })
    if (!harvest) {
      await sendText(from, '⚠️ Safra não encontrada. Tente novamente.')
      return
    }

    const category = EntryCategory[pending.category as keyof typeof EntryCategory] ?? EntryCategory.OTHER_EXPENSE
    const isIncome = (category as string === EntryCategory.PRODUCTION_SALE || category as string === EntryCategory.OTHER_INCOME)
    const parsedDate = pending.date ? new Date(pending.date) : null
    const entryDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : new Date()

    // Validate plotId
    let plotId: string | null = pending.plotId && String(pending.plotId).trim() ? pending.plotId : null
    if (plotId) {
      const plot = await prisma.plot.findFirst({ where: { id: plotId, property: { producerId } } })
      if (!plot) plotId = null
    }

    await prisma.entry.create({
      data: {
        harvestId,
        plotId,
        category,
        type: isIncome ? EntryType.INCOME : EntryType.EXPENSE,
        amount: Number(pending.amount) || 0,
        date: entryDate,
        supplier: pending.supplier ?? null,
        description: pending.description ?? null,
      },
    })

    // Clear pending from session
    const updatedMessages: AgentMessage[] = sessionMessages
      .filter((m) => (m as any).role !== 'pending_invoice')
      .slice(-40)

    if (session) {
      await prisma.agentSession.update({ where: { id: session.id }, data: { messages: updatedMessages as any } })
    }

    const categoryLabels: Record<string, string> = {
      FUEL: '⛽ Combustível', FERTILIZER: '🪨 Adubo', DEFENSIVE: '🌿 Defensivo',
      SEED: '🌱 Semente', MACHINERY_MAINTENANCE: '🔧 Manutenção', LABOR: '👷 Mão de Obra',
      LEASE: '🏡 Arrendamento', FREIGHT_DRYING: '🚛 Frete/Secagem',
      PRODUCTION_SALE: '💰 Venda', OTHER_INCOME: '📈 Receita', OTHER_EXPENSE: '📋 Despesa',
    }

    const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

    await sendText(
      from,
      `✅ *Lançamento registrado!*\n\n` +
      `📂 ${categoryLabels[category] ?? category}\n` +
      `💵 ${isIncome ? '+' : '-'} ${fmt(Number(pending.amount))}\n` +
      `📅 ${entryDate.toLocaleDateString('pt-BR')}\n` +
      (pending.supplier ? `🏪 ${pending.supplier}\n` : '') +
      `🌾 Safra: ${harvest.crop} ${harvest.year} — ${harvest.property.name}\n\n` +
      `_Visualize no painel em /dashboard/entries_`
    )
  } catch (err) {
    console.error('handleHarvestSelected error:', err)
    await sendText(from, '❌ Erro ao registrar o lançamento. Tente novamente.')
  }
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
