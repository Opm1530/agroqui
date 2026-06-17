import OpenAI from 'openai'
import { getSetting, SettingKeys } from './settings.service'
import { EntryCategory } from '@prisma/client'

async function getClient(): Promise<OpenAI> {
  const apiKey = await getSetting(SettingKeys.AI_API_KEY)
  if (!apiKey) throw new Error('AI API key not configured. Please configure it in Admin > Settings.')
  return new OpenAI({ apiKey })
}

async function getModel(): Promise<string> {
  return (await getSetting(SettingKeys.AI_MODEL)) ?? 'gpt-4o-mini'
}

// ─── OCR: extract structured data from invoice image ─────────────────────────

export interface InvoiceItem {
  description: string   // original description from NF
  product?: string      // normalized product name, e.g. "Diesel S10", "Ureia 45%"
  value: number         // total value for this item line
  quantity?: number
  unit?: string         // "L", "sc60kg", "kg", "t", "unid"
  unitPrice?: number    // value / quantity — price per unit
  ncm?: string          // NCM code from NF (e.g. "38089199")
}

export interface InvoiceData {
  supplier?: string
  supplierCnpj?: string
  amount?: number
  date?: string
  items?: InvoiceItem[]
  rawText?: string
}

export async function extractInvoiceData(imageBuffer: Buffer, mimeType: string): Promise<InvoiceData> {
  const openai = await getClient()
  const model = await getModel()

  const base64 = imageBuffer.toString('base64')
  const dataUrl = `data:${mimeType};base64,${base64}`

  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: dataUrl, detail: 'high' },
          },
          {
            type: 'text',
            text: `You are an OCR assistant specialized in Brazilian fiscal documents (Nota Fiscal).
Extract the following data from this invoice image and return ONLY valid JSON (no markdown, no explanation):
{
  "supplier": "company name",
  "supplierCnpj": "XX.XXX.XXX/XXXX-XX",
  "amount": 0.00,
  "date": "YYYY-MM-DD",
  "items": [
    {
      "description": "original description from NF",
      "product": "normalized product name (e.g. Diesel S10, Ureia 45%, Glifosato 480, Semente Soja)",
      "value": 0.00,
      "quantity": 0,
      "unit": "L or sc60kg or kg or t or unid",
      "unitPrice": 0.00,
      "ncm": "NCM code digits only, e.g. 38089199"
    }
  ],
  "rawText": "brief summary of what was purchased"
}
Rules:
- "unit" must be one of: L (liters), sc60kg (60kg sack), kg, t (ton), unid (unit/generic), ha
- "unitPrice" = value / quantity. Always calculate it.
- "product" should be a clean, normalized name (remove lot numbers, batch codes, etc.)
- "ncm" must be extracted from the NCM column in the DADOS DOS PRODUTOS table. Return digits only.
- If a field cannot be determined, use null. Amounts must be numbers (not strings).`,
          },
        ],
      },
    ],
    max_tokens: 1000,
  })

  const content = response.choices[0]?.message?.content ?? '{}'
  try {
    return JSON.parse(content) as InvoiceData
  } catch {
    return { rawText: content }
  }
}

// ─── OCR via text (for PDFs with extractable text) ───────────────────────────

export async function extractInvoiceDataFromText(text: string): Promise<InvoiceData> {
  const openai = await getClient()
  const model = await getModel()

  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: `You are an assistant specialized in Brazilian fiscal documents (Nota Fiscal).
Extract the following data from this invoice TEXT and return ONLY valid JSON (no markdown, no explanation):
{
  "supplier": "company name",
  "supplierCnpj": "XX.XXX.XXX/XXXX-XX",
  "amount": 0.00,
  "date": "YYYY-MM-DD",
  "items": [
    {
      "description": "original description",
      "product": "normalized product name (e.g. Diesel S10, Ureia 45%, Glifosato 480, Semente Soja)",
      "value": 0.00,
      "quantity": 0,
      "unit": "L or sc60kg or kg or t or unid",
      "unitPrice": 0.00,
      "ncm": "NCM code digits only, e.g. 38089199"
    }
  ],
  "rawText": "brief summary of what was purchased"
}
Rules:
- unitPrice = value / quantity. Always calculate it.
- "ncm" must be extracted from the NCM column in the DADOS DOS PRODUTOS/SERVIÇOS table. Return digits only.
- If a field cannot be determined, use null. Amounts must be numbers (not strings).

Invoice text:
${text.substring(0, 4000)}`,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 1000,
  })

  const content = response.choices[0]?.message?.content ?? '{}'
  try {
    return JSON.parse(content) as InvoiceData
  } catch {
    return { rawText: text.substring(0, 500) }
  }
}

// ─── Deterministic NCM-based classification ───────────────────────────────────
// Brazilian NCM codes map directly to agricultural input categories.
// This is always more reliable than AI keyword matching for trade names.

function classifyByNcm(ncm: string): EntryCategory | null {
  const n = ncm.replace(/\D/g, '') // digits only
  if (!n) return null

  // 3808xxxx — Pesticidas, herbicidas, fungicidas, inseticidas (defensivos agrícolas)
  if (n.startsWith('3808')) return EntryCategory.DEFENSIVE

  // Fertilizantes: nitrogenados (3102), fosfatados (3103), potássicos (3104), compostos (3105)
  if (n.startsWith('3102') || n.startsWith('3103') || n.startsWith('3104') || n.startsWith('3105'))
    return EntryCategory.FERTILIZER

  // Sementes: soja (1201), milho (1005), sorgo (1007), algodão (1207), girassol (1206)
  if (['1201', '1005', '1007', '1206', '1207', '1209'].some((p) => n.startsWith(p)))
    return EntryCategory.SEED

  // Combustíveis e óleos (2710)
  if (n.startsWith('2710')) return EntryCategory.FUEL

  return null
}

// ─── AI Classification: suggest category for an entry ────────────────────────

export async function classifyEntry(
  description: string,
  supplier?: string,
  ncmCodes?: string[]
): Promise<EntryCategory> {
  // 1️⃣ Try deterministic NCM classification first — always more accurate than AI for trade names
  if (ncmCodes?.length) {
    for (const ncm of ncmCodes) {
      const hit = classifyByNcm(ncm)
      if (hit) return hit
    }
  }

  // 2️⃣ Fallback to AI classification
  const openai = await getClient()
  const model = await getModel()

  const categories = Object.values(EntryCategory).join(', ')

  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: `You are an agricultural accounting assistant. Classify the given purchase/expense into one of these categories: ${categories}.
Return ONLY the category name, nothing else.

Categories:
- DEFENSIVE: herbicides, fungicides, insecticides, pesticides — includes any agroquímico, defensivo agrícola, inseticida, herbicida, fungicida, acaricida, nematicida, adjuvante. Also products with NCM starting with 3808.
- FERTILIZER: urea, MAP, limestone, gypsum, any fertilizer or soil corrective — includes adubo, fertilizante, ureia, calcário, gesso, MAP, KCL, potássio. NCM starting with 3102-3105.
- SEED: seeds for planting — includes semente, seed, soja, milho, sorgo. NCM starting with 1201, 1005, 1007.
- FUEL: diesel, gasoline, oil, lubricants — combustível, diesel, gasolina, óleo lubrificante.
- MACHINERY_MAINTENANCE: parts, tires, repairs, implements — peças, pneus, rolamento, correia, manutenção, implemento.
- LABOR: employees, operators, technical services, daily workers — funcionário, operador, diária, serviço técnico, mão de obra.
- LEASE: land rental — arrendamento, aluguel de terra.
- FREIGHT_DRYING: transport, storage, drying — frete, secagem, armazenagem, transporte.
- PRODUCTION_SALE: sale of soy, corn, cattle, etc. (INCOME) — venda de soja, milho, gado.
- OTHER_INCOME: subsidies, byproduct sales (INCOME)
- OTHER_EXPENSE: expenses not fitting above categories`,
      },
      {
        role: 'user',
        content: `Supplier: ${supplier ?? 'unknown'}\nDescription: ${description}`,
      },
    ],
    max_tokens: 20,
  })

  const raw = response.choices[0]?.message?.content?.trim().toUpperCase() ?? ''
  return (EntryCategory[raw as keyof typeof EntryCategory] ?? EntryCategory.OTHER_EXPENSE)
}

// ─── Conversational agent ─────────────────────────────────────────────────────

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AgentContext {
  producerName: string
  whatsapp: string
  activeHarvests: Array<{ id: string; crop: string; year: string; propertyName: string }>
  plots: Array<{ id: string; name: string }>
  products: Array<{ id: string; name: string; unit: string }>
  recentBalance?: number
}

export async function runAgent(
  messages: AgentMessage[],
  context: AgentContext,
  userMessage: string
): Promise<{ reply: string; action?: AgentAction }> {
  const openai = await getClient()
  const model = await getModel()

  const harvestList = context.activeHarvests.length
    ? context.activeHarvests.map((h) => `"${h.id}" → ${h.crop} ${h.year} (${h.propertyName})`).join('\n')
    : 'nenhuma safra ativa'

  const plotList = context.plots.length
    ? context.plots.map((p) => `"${p.id}" → ${p.name}`).join('\n')
    : 'nenhum talhão cadastrado'

  const productList = context.products.length
    ? context.products.map((p) => `"${p.id}" → ${p.name} (${p.unit})`).join('\n')
    : 'nenhum produto no estoque'

  const systemPrompt = `Você é o Autoqui, assistente financeiro do Contador do Campo para produtores rurais brasileiros.
Seu objetivo: ajudar o produtor a organizar as finanças da fazenda de forma simples e prática.

━━━ REGRAS DE COMPORTAMENTO ━━━
- Responda SEMPRE em português brasileiro informal
- Seja direto e curto — WhatsApp não é lugar para texto longo
- NÃO use jargão contábil — diga "custo por saca", não "custo unitário de produção"
- NÃO confirme que fez algo sem incluir a tag <action> correspondente
- NÃO diga "vou registrar" e espere outra mensagem — registre e confirme na MESMA resposta
- NÃO invente IDs — use EXATAMENTE os IDs listados abaixo

━━━ DADOS DO PRODUTOR ━━━
Nome: ${context.producerName}

Safras ativas (use o ID exato no harvestId):
${harvestList}

Talhões (use o ID exato no plotId, ou omita se não souber):
${plotList}

Produtos no estoque (use o ID exato no productId):
${productList}

━━━ COMO REGISTRAR UM LANÇAMENTO ━━━
Quando o produtor informar uma despesa ou receita com valor E data:
1. Extraia todos os dados que conseguir
2. Use a data de hoje se não informada: ${new Date().toISOString().split('T')[0]}
3. Escolha o harvestId da safra mais recente se só houver uma
4. Inclua a tag <action> com os dados E envie a confirmação — TUDO na mesma mensagem
5. NUNCA diga "registrei" sem incluir a tag <action>

Categorias disponíveis:
FUEL (combustível/diesel/gasolina), FERTILIZER (adubo/ureia/calcário), DEFENSIVE (herbicida/fungicida/inseticida),
SEED (semente), MACHINERY_MAINTENANCE (peça/reparo/manutenção), LABOR (mão de obra/diária/funcionário),
LEASE (arrendamento), FREIGHT_DRYING (frete/secagem/armazém),
PRODUCTION_SALE (venda de grãos - RECEITA), OTHER_INCOME (outra receita), OTHER_EXPENSE (outros gastos)

Tag de ação para REGISTRAR (inclua no corpo da mensagem):
<action>{"type":"REGISTER_ENTRY","data":{"harvestId":"ID_EXATO_AQUI","plotId":null,"category":"FUEL","amount":2300,"date":"2026-04-28","supplier":"Posto Xará","description":"Diesel S10 - 343L a R$6,70/L"}}</action>

━━━ COMO REGISTRAR UMA ATIVIDADE ━━━
Quando o produtor descrever uma atividade de campo (plantio, aplicação, abastecimento, colheita):
1. Identifique o tipo: PLANTING (plantio), APPLICATION (aplicação de defensivo/fertilizante), FUELING (abastecimento), HARVEST_OP (colheita), OTHER
2. Identifique a safra, talhão (se mencionado), data, hectares trabalhados e produtos usados
3. Para cada produto mencionado, encontre o ID mais próximo na lista de produtos do estoque
4. NÃO registre diretamente — envie uma proposta para o produtor confirmar:

Tag de ação para PROPOR ATIVIDADE (inclua no corpo da mensagem):
<action>{"type":"PROPOSE_ACTIVITY","data":{"harvestId":"ID_EXATO","plotId":null,"activityType":"APPLICATION","date":"2026-06-16","hectares":null,"notes":"Aplicação de Glifosato","items":[{"productId":"ID_EXATO","productName":"Glifosato 480","quantity":10,"unit":"LITER"}]}}</action>

Após incluir a tag, envie um resumo amigável pedindo confirmação. Exemplo:
"🌱 *Atividade identificada:*
📋 Aplicação — Soja 2025/26
📅 16/06/2026
🧴 Glifosato 480: 10 L

Confirma? Responda *sim* para registrar ou *não* para cancelar."

━━━ COMO GERAR RELATÓRIO / VER SALDO ━━━
Quando o produtor pedir relatório, DRE, despesas ou saldo:
- Responda: "📊 Gerando..." e inclua a tag:
<action>{"type":"GENERATE_REPORT","harvestId":"ID_DA_SAFRA"}</action>

O sistema vai buscar os dados reais e enviar automaticamente — você NÃO precisa inventar números.

━━━ SE FALTAR INFORMAÇÃO ━━━
Só peça mais dados se realmente não tiver o suficiente para registrar (ex: valor faltando).
Se tiver valor e categoria, registre e informe o que assumiu.`

  const history: AgentMessage[] = [
    { role: 'system', content: systemPrompt },
    // Strip any internal session roles (pending_activity etc.) — OpenAI only accepts system/user/assistant
    ...messages.filter((m) => ['user', 'assistant', 'system'].includes(m.role)).slice(-20),
    { role: 'user', content: userMessage },
  ]

  const response = await openai.chat.completions.create({
    model,
    messages: history,
    max_tokens: 600,
  })

  const full = response.choices[0]?.message?.content ?? 'Desculpe, não consegui processar sua mensagem.'

  // Extract action if present
  const actionMatch = full.match(/<action>([\s\S]*?)<\/action>/)
  let action: AgentAction | undefined
  let reply = full.replace(/<action>[\s\S]*?<\/action>/g, '').trim()

  if (actionMatch) {
    try {
      action = JSON.parse(actionMatch[1]) as AgentAction
    } catch {
      // ignore malformed action
    }
  }

  return { reply, action }
}

export type AgentAction =
  | { type: 'REGISTER_ENTRY'; data: { harvestId: string; plotId?: string; category: string; amount: number; date: string; supplier?: string; description?: string } }
  | { type: 'PROPOSE_ACTIVITY'; data: { harvestId: string; plotId?: string; activityType: string; date: string; hectares?: number; notes?: string; items: Array<{ productId: string; productName: string; quantity: number; unit: string }> } }
  | { type: 'GENERATE_REPORT'; harvestId: string }
  | { type: 'SHOW_BALANCE' }
  | { type: 'LIST_HARVESTS' }
