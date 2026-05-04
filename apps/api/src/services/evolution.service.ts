import { getSetting, SettingKeys } from './settings.service'

interface SendTextOptions {
  instance: string
  to: string
  text: string
}

interface EvolutionConfig {
  url: string
  apiKey: string
  mainInstance: string
}

async function getConfig(): Promise<EvolutionConfig> {
  const settings = await Promise.all([
    getSetting(SettingKeys.EVOLUTION_API_URL),
    getSetting(SettingKeys.EVOLUTION_API_KEY),
    getSetting(SettingKeys.EVOLUTION_MAIN_INSTANCE),
  ])
  const [rawUrl, apiKey, mainInstance] = settings
  if (!rawUrl || !apiKey || !mainInstance) {
    throw new Error('Evolution API not configured. Please configure it in Admin > Settings.')
  }
  // Strip trailing slash so paths like /message/sendText always resolve correctly
  const url = rawUrl.replace(/\/+$/, '')
  return { url, apiKey, mainInstance }
}

export async function sendText(to: string, text: string): Promise<void> {
  const config = await getConfig()

  const resp = await fetch(`${config.url}/message/sendText/${config.mainInstance}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.apiKey,
    },
    body: JSON.stringify({
      number: to,
      text,
    }),
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Evolution API error ${resp.status}: ${body}`)
  }
}

export async function sendFile(to: string, fileUrl: string, caption?: string): Promise<void> {
  const config = await getConfig()

  const resp = await fetch(`${config.url}/message/sendMedia/${config.mainInstance}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.apiKey,
    },
    body: JSON.stringify({
      number: to,
      mediatype: 'document',
      media: fileUrl,
      caption,
    }),
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Evolution API error ${resp.status}: ${body}`)
  }
}

// ── Interactive buttons (max 3) ───────────────────────────────────────────────
export interface ButtonOption {
  id: string
  title: string
}

export async function sendButtons(
  to: string,
  title: string,
  description: string,
  footer: string,
  buttons: ButtonOption[]
): Promise<void> {
  const config = await getConfig()

  const resp = await fetch(`${config.url}/message/sendButtons/${config.mainInstance}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: config.apiKey },
    body: JSON.stringify({
      number: to,
      title,
      description,
      footer,
      buttons: buttons.slice(0, 3).map((b) => ({
        type: 'reply',
        reply: { id: b.id, title: b.title.substring(0, 20) },
      })),
    }),
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Evolution sendButtons error ${resp.status}: ${body}`)
  }
}

// ── List message (up to ~10 options) ─────────────────────────────────────────
export interface ListRow {
  rowId: string
  title: string
  description?: string
}

export async function sendList(
  to: string,
  title: string,
  description: string,
  footer: string,
  buttonText: string,
  rows: ListRow[]
): Promise<void> {
  const config = await getConfig()

  const resp = await fetch(`${config.url}/message/sendList/${config.mainInstance}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: config.apiKey },
    body: JSON.stringify({
      number: to,
      title,
      description,
      footer,
      buttonText,
      sections: [{ title: 'Safras ativas', rows }],
    }),
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Evolution sendList error ${resp.status}: ${body}`)
  }
}

export async function getMainInstance(): Promise<string> {
  const config = await getConfig()
  return config.mainInstance
}

export async function downloadMedia(
  instance: string,
  messageId: string,
  remoteJid?: string
): Promise<Buffer> {
  const config = await getConfig()

  // Use configured instance as fallback (instance from payload root is most reliable)
  const inst = instance || config.mainInstance

  const resp = await fetch(`${config.url}/chat/getBase64FromMediaMessage/${inst}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.apiKey,
    },
    body: JSON.stringify({
      message: {
        key: {
          id: messageId,
          ...(remoteJid ? { remoteJid, fromMe: false } : {}),
        },
      },
      convertToMp4: false,
    }),
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Failed to download media: ${resp.status} — ${body}`)
  }

  const json = await resp.json() as { base64?: string; mediaUrl?: string }

  // Evolution API v2 may return base64 directly or nested
  const b64 = json.base64 ?? (json as any)?.data?.base64 ?? (json as any)?.message?.base64
  if (!b64) throw new Error(`Media response has no base64 data: ${JSON.stringify(json).substring(0, 200)}`)

  return Buffer.from(b64, 'base64')
}
