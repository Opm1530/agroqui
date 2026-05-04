import { prisma } from '../config/prisma'

export const SettingKeys = {
  // Stripe
  STRIPE_SECRET_KEY: 'stripe_secret_key',
  STRIPE_WEBHOOK_SECRET: 'stripe_webhook_secret',
  STRIPE_PUBLISHABLE_KEY: 'stripe_publishable_key',

  // Evolution API (WhatsApp)
  EVOLUTION_API_URL: 'evolution_api_url',
  EVOLUTION_API_KEY: 'evolution_api_key',
  EVOLUTION_MAIN_INSTANCE: 'evolution_main_instance',
  EVOLUTION_MAIN_INSTANCE_NUMBER: 'evolution_main_instance_number',
  EVOLUTION_WEBHOOK_URL: 'evolution_webhook_url',
  WHATSAPP_PROVIDER: 'whatsapp_provider',

  // AI
  AI_PROVIDER: 'ai_provider',
  AI_API_KEY: 'ai_api_key',
  AI_MODEL: 'ai_model',

  // App
  APP_NAME: 'app_name',
  SUPPORT_WHATSAPP: 'support_whatsapp',
} as const

export type SettingKey = (typeof SettingKeys)[keyof typeof SettingKeys]

export async function getSetting(key: SettingKey): Promise<string | null> {
  const setting = await prisma.setting.findUnique({ where: { key } })
  return setting?.value ?? null
}

export async function getSettings(keys: SettingKey[]): Promise<Record<string, string>> {
  const settings = await prisma.setting.findMany({ where: { key: { in: keys } } })
  return Object.fromEntries(settings.map((s) => [s.key, s.value]))
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}

export async function setSettings(entries: Partial<Record<SettingKey, string>>): Promise<void> {
  const ops = Object.entries(entries).map(([key, value]) =>
    prisma.setting.upsert({
      where: { key },
      update: { value: value! },
      create: { key, value: value! },
    })
  )
  await prisma.$transaction(ops)
}
