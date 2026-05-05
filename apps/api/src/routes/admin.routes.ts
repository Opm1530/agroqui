import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requireAdmin, requireSuperAdmin, AuthRequest } from '../middleware/auth'
import { prisma } from '../config/prisma'
import { createAdminUser, hashPassword } from '../services/auth.service'
import { setSetting, setSettings, getSettings, SettingKeys } from '../services/settings.service'
import { UserRole, PlanType } from '@prisma/client'

const router = Router()
router.use(authenticate, requireAdmin)

// ─── Settings ─────────────────────────────────────────────────────────────────

const settingsSchema = z.object({
  // Stripe
  stripe_secret_key: z.string().optional(),
  stripe_webhook_secret: z.string().optional(),
  stripe_publishable_key: z.string().optional(),
  // Evolution
  evolution_api_url: z.string().url().optional(),
  evolution_api_key: z.string().optional(),
  evolution_main_instance: z.string().optional(),
  evolution_main_instance_number: z.string().optional(),
  evolution_webhook_url: z.string().optional(),
  whatsapp_provider: z.enum(['EVOLUTION', 'OFFICIAL']).optional(),
  // AI
  ai_provider: z.enum(['OPENAI', 'ANTHROPIC']).optional(),
  ai_api_key: z.string().optional(),
  ai_model: z.string().optional(),
  // App
  app_name: z.string().optional(),
  support_whatsapp: z.string().optional(),
})

router.get('/settings', async (req, res, next) => {
  try {
    const settings = await getSettings(Object.values(SettingKeys))
    // Mask sensitive keys
    const masked = { ...settings }
    const sensitiveKeys = ['stripe_secret_key', 'evolution_api_key', 'ai_api_key']
    for (const key of sensitiveKeys) {
      if (masked[key]) masked[key] = masked[key].slice(0, 8) + '••••••••'
    }
    res.json(masked)
  } catch (err) {
    next(err)
  }
})

router.put('/settings', async (req, res, next) => {
  try {
    const data = settingsSchema.parse(req.body)
    const filtered = Object.fromEntries(
      Object.entries(data).filter(([, v]) =>
        v !== undefined && v !== '' && !String(v).includes('••••••••')
      )
    ) as Record<string, string>
    await setSettings(filtered as any)
    res.json({ message: 'Settings updated' })
  } catch (err) {
    next(err)
  }
})

// ─── Plans ────────────────────────────────────────────────────────────────────

const planSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(PlanType),
  priceMonthly: z.number().positive(),
  maxProperties: z.number().int().positive().default(1),
  maxUsers: z.number().int().positive().default(1),
  hasOcr: z.boolean().default(false),
  hasAiAgent: z.boolean().default(false),
  hasAutoDre: z.boolean().default(false),
  hasAlerts: z.boolean().default(false),
  hasWhitelabel: z.boolean().default(false),
  hasPrioritySupport: z.boolean().default(false),
  isActive: z.boolean().default(true),
  stripePriceId: z.string().optional(),
})

router.get('/plans', async (req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({ orderBy: { priceMonthly: 'asc' } })
    res.json(plans)
  } catch (err) {
    next(err)
  }
})

router.post('/plans', async (req, res, next) => {
  try {
    const data = planSchema.parse(req.body)
    const plan = await prisma.plan.create({ data })
    res.status(201).json(plan)
  } catch (err) {
    next(err)
  }
})

router.put('/plans/:id', async (req, res, next) => {
  try {
    const data = planSchema.partial().parse(req.body)
    const plan = await prisma.plan.update({ where: { id: req.params.id }, data })
    res.json(plan)
  } catch (err) {
    next(err)
  }
})

router.delete('/plans/:id', requireSuperAdmin, async (req, res, next) => {
  try {
    await prisma.plan.update({ where: { id: req.params.id }, data: { isActive: false } })
    res.json({ message: 'Plan deactivated' })
  } catch (err) {
    next(err)
  }
})

// ─── Admin Users ──────────────────────────────────────────────────────────────

const adminUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum([UserRole.ADMIN, UserRole.SUPER_ADMIN]).default(UserRole.ADMIN),
})

router.get('/users', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] } },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json(users)
  } catch (err) {
    next(err)
  }
})

router.post('/users', requireSuperAdmin, async (req, res, next) => {
  try {
    const data = adminUserSchema.parse(req.body)
    const user = await createAdminUser(data)
    res.status(201).json(user)
  } catch (err) {
    next(err)
  }
})

router.put('/users/:id', requireSuperAdmin, async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().optional(),
      isActive: z.boolean().optional(),
      password: z.string().min(8).optional(),
    })
    const data = schema.parse(req.body)
    const updateData: any = { ...data }
    if (data.password) {
      updateData.passwordHash = await hashPassword(data.password)
      delete updateData.password
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    })
    res.json(user)
  } catch (err) {
    next(err)
  }
})

// ─── Producers (admin view) ───────────────────────────────────────────────────

router.get('/producers', async (req, res, next) => {
  try {
    const producers = await prisma.producer.findMany({
      include: {
        user: { select: { name: true, email: true, isActive: true } },
        subscriptions: {
          include: { plan: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        cooperative: { select: { name: true } },
        _count: { select: { properties: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(producers)
  } catch (err) {
    next(err)
  }
})

// ─── Complimentary access ─────────────────────────────────────────────────────

router.post('/producers/:id/complimentary', requireSuperAdmin, async (req, res, next) => {
  try {
    const existing = await prisma.subscription.findFirst({
      where: { producerId: req.params.id },
      orderBy: { createdAt: 'desc' },
    })

    if (existing) {
      // Already has a subscription — just update the status
      const updated = await prisma.subscription.update({
        where: { id: existing.id },
        data: { status: 'COMPLIMENTARY' },
      })
      return res.json(updated)
    }

    // No subscription yet — create one with the best available plan
    const plan = await prisma.plan.findFirst({
      where: { isActive: true, type: { in: ['PRO', 'BASIC'] } },
      orderBy: { priceMonthly: 'desc' }, // prefer Pro
    })
    if (!plan) return res.status(404).json({ error: 'Nenhum plano ativo encontrado para criar a cortesia' })

    const created = await prisma.subscription.create({
      data: { producerId: req.params.id, planId: plan.id, status: 'COMPLIMENTARY' },
    })
    res.json(created)
  } catch (err) {
    next(err)
  }
})

router.delete('/producers/:id/complimentary', requireSuperAdmin, async (req, res, next) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { producerId: req.params.id },
      orderBy: { createdAt: 'desc' },
    })
    if (!subscription) return res.status(404).json({ error: 'Subscription not found' })
    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELED' },
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// ─── Delete producer + user (hard delete, cascades manually) ─────────────────

router.delete('/producers/:id', requireSuperAdmin, async (req, res, next) => {
  try {
    const producer = await prisma.producer.findUnique({
      where: { id: req.params.id },
      include: { properties: { include: { harvests: true, plots: true } } },
    })
    if (!producer) return res.status(404).json({ error: 'Produtor não encontrado' })

    await prisma.$transaction(async (tx) => {
      // 1. Delete entries and documents per harvest
      for (const prop of producer.properties) {
        for (const harvest of prop.harvests) {
          await tx.entry.deleteMany({ where: { harvestId: harvest.id } })
        }
        await tx.harvest.deleteMany({ where: { propertyId: prop.id } })
        await tx.plot.deleteMany({ where: { propertyId: prop.id } })
        await tx.property.delete({ where: { id: prop.id } })
      }
      // 2. Delete related records
      await tx.document.deleteMany({ where: { producerId: producer.id } })
      await tx.alert.deleteMany({ where: { producerId: producer.id } })
      await tx.agentSession.deleteMany({ where: { producerId: producer.id } })
      await tx.subscription.deleteMany({ where: { producerId: producer.id } })
      // 3. Delete producer and user
      await tx.producer.delete({ where: { id: producer.id } })
      await tx.user.delete({ where: { id: producer.userId } })
    })

    res.json({ message: 'Produtor excluído com sucesso' })
  } catch (err) {
    next(err)
  }
})

// ─── Cooperatives (admin view) ────────────────────────────────────────────────

router.get('/cooperatives', async (req, res, next) => {
  try {
    const cooperatives = await prisma.cooperative.findMany({
      include: {
        user: { select: { name: true, email: true } },
        plan: { select: { name: true, priceMonthly: true } },
        _count: { select: { producers: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(cooperatives)
  } catch (err) {
    next(err)
  }
})

router.post('/cooperatives', async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      cnpj: z.string().optional(),
      subdomain: z.string().min(3).regex(/^[a-z0-9-]+$/),
      planId: z.string(),
      primaryColor: z.string().optional(),
      // Admin user for the cooperative
      adminName: z.string().min(1),
      adminEmail: z.string().email(),
      adminPassword: z.string().min(8),
    })
    const data = schema.parse(req.body)

    const result = await prisma.$transaction(async (tx) => {
      const passwordHash = await hashPassword(data.adminPassword)
      const user = await tx.user.create({
        data: {
          name: data.adminName,
          email: data.adminEmail,
          passwordHash,
          role: UserRole.COOPERATIVE,
        },
      })
      const cooperative = await tx.cooperative.create({
        data: {
          userId: user.id,
          name: data.name,
          cnpj: data.cnpj,
          subdomain: data.subdomain,
          planId: data.planId,
          primaryColor: data.primaryColor,
        },
      })
      return { user, cooperative }
    })

    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
})

// ─── WhatsApp helpers ─────────────────────────────────────────────────────────

async function getEvolutionConfig() {
  const settings = await getSettings([
    SettingKeys.EVOLUTION_API_URL,
    SettingKeys.EVOLUTION_API_KEY,
    SettingKeys.EVOLUTION_MAIN_INSTANCE,
  ])
  const url = settings.evolution_api_url?.replace(/\/+$/, '') // remove trailing slash
  const apiKey = settings.evolution_api_key
  const instance = settings.evolution_main_instance
  return { url, apiKey, instance, configured: !!(url && apiKey && instance) }
}

async function evolutionFetch(url: string, apiKey: string, path: string, options: RequestInit = {}) {
  const fullUrl = `${url}${path}`
  const resp = await fetch(fullUrl, {
    ...options,
    headers: { apikey: apiKey, 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  })
  const text = await resp.text()
  try { return { ok: resp.ok, status: resp.status, data: JSON.parse(text) }
  } catch { return { ok: resp.ok, status: resp.status, data: text } }
}

// ─── WhatsApp Instance status ─────────────────────────────────────────────────

router.get('/whatsapp/status', async (req, res) => {
  try {
    const cfg = await getEvolutionConfig()
    if (!cfg.configured) return res.json({ connected: false, reason: 'Evolution API not configured' })

    const { ok, data } = await evolutionFetch(cfg.url!, cfg.apiKey!, `/instance/fetchInstances`)
    if (!ok) return res.json({ connected: false, reason: 'Could not reach Evolution API' })

    const list = Array.isArray(data) ? data : []
    const found = list.find((i: any) =>
      i.instance?.instanceName === cfg.instance || i.name === cfg.instance
    )
    res.json({
      connected: found?.instance?.state === 'open' || found?.connectionStatus === 'open',
      state: found?.instance?.state ?? found?.connectionStatus ?? 'not_found',
      name: cfg.instance,
      allInstances: list.map((i: any) => i.instance?.instanceName ?? i.name),
    })
  } catch (err: any) {
    res.json({ connected: false, reason: err.message })
  }
})

// ─── Create instance ──────────────────────────────────────────────────────────

router.post('/whatsapp/create-instance', async (req, res) => {
  try {
    const cfg = await getEvolutionConfig()
    if (!cfg.url || !cfg.apiKey) {
      return res.status(400).json({ error: 'Evolution URL and API Key must be saved first' })
    }

    const { instanceName } = req.body
    if (!instanceName) return res.status(400).json({ error: 'instanceName is required' })

    const { ok, data } = await evolutionFetch(cfg.url, cfg.apiKey, '/instance/create', {
      method: 'POST',
      body: JSON.stringify({ instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
    })

    if (!ok) return res.status(400).json({ error: 'Failed to create instance', details: data })

    // Save as main instance automatically
    await setSetting(SettingKeys.EVOLUTION_MAIN_INSTANCE, instanceName)

    res.json({ success: true, instance: data })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ─── List instances ───────────────────────────────────────────────────────────

router.get('/whatsapp/instances', async (req, res) => {
  try {
    const cfg = await getEvolutionConfig()
    if (!cfg.url || !cfg.apiKey) return res.json([])

    const { ok, data } = await evolutionFetch(cfg.url, cfg.apiKey, '/instance/fetchInstances')
    if (!ok) return res.json([])

    const list = Array.isArray(data) ? data : []
    res.json(list.map((i: any) => ({
      name: i.instance?.instanceName ?? i.name,
      state: i.instance?.state ?? i.connectionStatus,
    })))
  } catch {
    res.json([])
  }
})

// ─── QR Code ─────────────────────────────────────────────────────────────────

router.get('/whatsapp/qrcode', async (req, res) => {
  try {
    const cfg = await getEvolutionConfig()
    if (!cfg.configured) return res.status(400).json({ error: 'Evolution API not configured' })

    const { ok, data } = await evolutionFetch(cfg.url!, cfg.apiKey!, `/instance/connect/${cfg.instance}`)
    if (!ok) return res.status(400).json({ error: 'Failed to get QR code', details: data })
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Set webhook ──────────────────────────────────────────────────────────────

router.post('/whatsapp/set-webhook', async (req, res) => {
  try {
    const cfg = await getEvolutionConfig()
    if (!cfg.configured) return res.status(400).json({ error: 'Evolution API not configured. Save URL, API Key and instance name first.' })

    const { webhookUrl } = req.body
    if (!webhookUrl) return res.status(400).json({ error: 'webhookUrl is required' })

    // Save webhook URL to settings for future reference
    await setSetting(SettingKeys.EVOLUTION_WEBHOOK_URL, webhookUrl)

    // Evolution API v2 — try the current v2 structure first
    const bodyV2 = {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: false,
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
      },
    }

    let result = await evolutionFetch(cfg.url!, cfg.apiKey!, `/webhook/set/${cfg.instance}`, {
      method: 'POST',
      body: JSON.stringify(bodyV2),
    })

    // Fallback: try flat structure (some Evolution v2 builds use this)
    if (!result.ok) {
      const bodyFlat = {
        url: webhookUrl,
        webhook_by_events: false,
        webhook_base64: false,
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
      }
      result = await evolutionFetch(cfg.url!, cfg.apiKey!, `/webhook/set/${cfg.instance}`, {
        method: 'POST',
        body: JSON.stringify(bodyFlat),
      })
    }

    if (!result.ok) {
      return res.status(400).json({
        error: 'Failed to set webhook on Evolution API',
        details: result.data,
        tip: 'Check that the instance name is correct and the instance exists.',
      })
    }

    res.json({ success: true, webhookUrl, data: result.data })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Delete instance ──────────────────────────────────────────────────────────

router.delete('/whatsapp/instances/:name', async (req, res) => {
  try {
    const cfg = await getEvolutionConfig()
    if (!cfg.url || !cfg.apiKey) return res.status(400).json({ error: 'Not configured' })

    const { ok, data } = await evolutionFetch(cfg.url, cfg.apiKey, `/instance/delete/${req.params.name}`, {
      method: 'DELETE',
    })
    res.json({ success: ok, data })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Dashboard stats ──────────────────────────────────────────────────────────

router.get('/dashboard', async (req, res, next) => {
  try {
    const [producers, cooperatives, activeSubs, plans] = await Promise.all([
      prisma.producer.count(),
      prisma.cooperative.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.plan.findMany({ where: { isActive: true }, select: { name: true, _count: { select: { subscriptions: true } } } }),
    ])
    res.json({ producers, cooperatives, activeSubs, plans })
  } catch (err) {
    next(err)
  }
})

export default router
