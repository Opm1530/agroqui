import { Router } from 'express'
import { z } from 'zod'
import { authenticate, AuthRequest } from '../middleware/auth'
import { prisma } from '../config/prisma'
import { EntryCategory, EntryType, HarvestStatus } from '@prisma/client'
import { hashPassword } from '../services/auth.service'
import { UserRole } from '@prisma/client'

const router = Router()
router.use(authenticate)

function getProducerId(req: AuthRequest): string {
  if (!req.user?.producerId) throw new Error('Producer not found')
  return req.user.producerId
}

// ─── Properties ───────────────────────────────────────────────────────────────

router.get('/properties', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const properties = await prisma.property.findMany({
      where: { producerId, isActive: true },
      include: { _count: { select: { harvests: true, plots: true } } },
    })
    res.json(properties)
  } catch (err) { next(err) }
})

router.post('/properties', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const schema = z.object({
      name: z.string().min(1),
      hectares: z.number().positive().optional(),
      state: z.string().optional(),
      city: z.string().optional(),
    })
    const data = schema.parse(req.body)
    const property = await prisma.property.create({ data: { ...data, producerId } })
    res.status(201).json(property)
  } catch (err) { next(err) }
})

// ─── Harvests ─────────────────────────────────────────────────────────────────

router.get('/harvests', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const harvests = await prisma.harvest.findMany({
      where: { property: { producerId } },
      include: {
        property: { select: { name: true } },
        _count: { select: { entries: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(harvests)
  } catch (err) { next(err) }
})

router.post('/harvests', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const schema = z.object({
      propertyId: z.string(),
      crop: z.string().min(1),
      year: z.string().min(4),
      targetCostPerHa: z.number().positive().optional(),
    })
    const data = schema.parse(req.body)
    // Verify property belongs to producer
    const property = await prisma.property.findFirst({ where: { id: data.propertyId, producerId } })
    if (!property) return res.status(404).json({ error: 'Property not found' })

    const harvest = await prisma.harvest.create({ data: { ...data, status: HarvestStatus.PLANNING } })
    res.status(201).json(harvest)
  } catch (err) { next(err) }
})

router.put('/harvests/:id', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const schema = z.object({
      crop: z.string().optional(),
      year: z.string().optional(),
      targetCostPerHa: z.number().positive().optional(),
      status: z.nativeEnum(HarvestStatus).optional(),
    })
    const data = schema.parse(req.body)
    // Verify ownership
    const harvest = await prisma.harvest.findFirst({
      where: { id: req.params.id, property: { producerId } },
    })
    if (!harvest) return res.status(404).json({ error: 'Harvest not found' })
    const updated = await prisma.harvest.update({ where: { id: req.params.id }, data })
    res.json(updated)
  } catch (err) { next(err) }
})

// ─── Plots ────────────────────────────────────────────────────────────────────

router.get('/plots', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const { propertyId } = req.query
    const plots = await prisma.plot.findMany({
      where: { property: { producerId }, ...(propertyId ? { propertyId: String(propertyId) } : {}) },
    })
    res.json(plots)
  } catch (err) { next(err) }
})

router.post('/plots', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const schema = z.object({
      propertyId: z.string(),
      name: z.string().min(1),
      hectares: z.number().positive().optional(),
      currentCrop: z.string().optional(),
    })
    const data = schema.parse(req.body)
    const property = await prisma.property.findFirst({ where: { id: data.propertyId, producerId } })
    if (!property) return res.status(404).json({ error: 'Property not found' })
    const plot = await prisma.plot.create({ data })
    res.status(201).json(plot)
  } catch (err) { next(err) }
})

// Save plot boundary (GeoJSON polygon) and color from map editor
router.put('/plots/:id/boundary', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const plot = await prisma.plot.findFirst({
      where: { id: req.params.id, property: { producerId } },
    })
    if (!plot) return res.status(404).json({ error: 'Plot not found' })

    const schema = z.object({
      boundary: z.array(z.tuple([z.number(), z.number()])).min(3), // [[lng,lat], ...]
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      hectares: z.number().positive().optional(),
    })
    const data = schema.parse(req.body)
    const updated = await prisma.plot.update({
      where: { id: req.params.id },
      data: {
        boundary: data.boundary as any,
        ...(data.color ? { color: data.color } : {}),
        ...(data.hectares ? { hectares: data.hectares } : {}),
      },
    })
    res.json(updated)
  } catch (err) { next(err) }
})

// ─── Entries (lancamentos) ────────────────────────────────────────────────────

router.get('/entries', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const { harvestId, plotId, category, type, page = '1', limit = '50' } = req.query
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = { harvest: { property: { producerId } } }
    if (harvestId) where.harvestId = String(harvestId)
    if (plotId) where.plotId = String(plotId)
    if (category) where.category = String(category)
    if (type) where.type = String(type)

    const [entries, total] = await Promise.all([
      prisma.entry.findMany({
        where,
        include: {
          harvest: { select: { crop: true, year: true } },
          plot: { select: { name: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.entry.count({ where }),
    ])

    res.json({ entries, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch (err) { next(err) }
})

router.post('/entries', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const schema = z.object({
      harvestId: z.string(),
      plotId: z.string().optional(),
      category: z.nativeEnum(EntryCategory),
      amount: z.number().positive(),
      date: z.string(),
      supplier: z.string().optional(),
      supplierCnpj: z.string().optional(),
      description: z.string().optional(),
    })
    const data = schema.parse(req.body)

    // Verify harvest belongs to producer
    const harvest = await prisma.harvest.findFirst({
      where: { id: data.harvestId, property: { producerId } },
    })
    if (!harvest) return res.status(404).json({ error: 'Harvest not found' })

    const isIncome = (data.category as string === EntryCategory.PRODUCTION_SALE || data.category as string === EntryCategory.OTHER_INCOME)
    const entry = await prisma.entry.create({
      data: {
        ...data,
        date: new Date(data.date),
        type: isIncome ? EntryType.INCOME : EntryType.EXPENSE,
      },
    })
    res.status(201).json(entry)
  } catch (err) { next(err) }
})

router.delete('/entries/:id', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const entry = await prisma.entry.findFirst({
      where: { id: req.params.id, harvest: { property: { producerId } } },
    })
    if (!entry) return res.status(404).json({ error: 'Entry not found' })
    await prisma.entry.delete({ where: { id: req.params.id } })
    res.json({ message: 'Entry deleted' })
  } catch (err) { next(err) }
})

// ─── DRE Report ───────────────────────────────────────────────────────────────

router.get('/dre/:harvestId', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const harvest = await prisma.harvest.findFirst({
      where: { id: req.params.harvestId, property: { producerId } },
      include: { property: true },
    })
    if (!harvest) return res.status(404).json({ error: 'Harvest not found' })

    const entries = await prisma.entry.findMany({
      where: { harvestId: req.params.harvestId },
      include: { plot: { select: { name: true } } },
    })

    const income = entries.filter((e) => e.type === EntryType.INCOME)
    const expenses = entries.filter((e) => e.type === EntryType.EXPENSE)

    const totalIncome = income.reduce((s, e) => s + e.amount, 0)
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
    const netProfit = totalIncome - totalExpenses

    // Group expenses by category
    const byCategory: Record<string, number> = {}
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount
    }

    // Cost per hectare
    const hectares = harvest.property.hectares ?? 1
    const costPerHa = totalExpenses / hectares

    res.json({
      harvest: {
        id: harvest.id,
        crop: harvest.crop,
        year: harvest.year,
        propertyId: harvest.propertyId,
        propertyName: harvest.property.name,
        hectares,
        targetCostPerHa: harvest.targetCostPerHa,
      },
      summary: {
        totalIncome,
        totalExpenses,
        netProfit,
        costPerHa,
        margin: totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : '0',
      },
      expensesByCategory: byCategory,
      entries,
    })
  } catch (err) { next(err) }
})

// ─── Alerts ───────────────────────────────────────────────────────────────────

router.get('/alerts', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const alerts = await prisma.alert.findMany({
      where: { producerId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    res.json(alerts)
  } catch (err) { next(err) }
})

router.put('/alerts/:id/read', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    await prisma.alert.updateMany({
      where: { id: req.params.id, producerId },
      data: { isRead: true },
    })
    res.json({ message: 'Alert marked as read' })
  } catch (err) { next(err) }
})

// ─── Subscription (current producer) ─────────────────────────────────────────

router.get('/subscription', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const subscription = await prisma.subscription.findFirst({
      where: { producerId },
      include: {
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(subscription ?? null)
  } catch (err) { next(err) }
})

// ─── Properties update ────────────────────────────────────────────────────────

router.put('/properties/:id', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const property = await prisma.property.findFirst({ where: { id: req.params.id, producerId } })
    if (!property) return res.status(404).json({ error: 'Property not found' })
    const schema = z.object({
      name: z.string().optional(),
      hectares: z.number().positive().optional(),
      state: z.string().optional(),
      city: z.string().optional(),
    })
    const data = schema.parse(req.body)
    const updated = await prisma.property.update({ where: { id: req.params.id }, data })
    res.json(updated)
  } catch (err) { next(err) }
})

// ─── Registration (public) ────────────────────────────────────────────────────

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  whatsapp: z.string().min(10),
  cpfCnpj: z.string().optional(),
  planId: z.string(),
  cooperativeId: z.string().optional(),
})

// This is public — no auth middleware applied at route level
export async function registerProducer(req: any, res: any, next: any) {
  try {
    const data = registerSchema.parse(req.body)

    const plan = await prisma.plan.findUnique({ where: { id: data.planId, isActive: true } })
    if (!plan) return res.status(404).json({ error: 'Plan not found' })

    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) return res.status(400).json({ error: 'Email already in use' })

    const existingWa = await prisma.producer.findUnique({ where: { whatsapp: data.whatsapp } })
    if (existingWa) return res.status(400).json({ error: 'WhatsApp already registered' })

    const passwordHash = await hashPassword(data.password)

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: data.name, email: data.email, passwordHash, role: UserRole.PRODUCER },
      })
      const producer = await tx.producer.create({
        data: {
          userId: user.id,
          whatsapp: data.whatsapp,
          cpfCnpj: data.cpfCnpj,
          cooperativeId: data.cooperativeId,
        },
      })
      await tx.subscription.create({
        data: { producerId: producer.id, planId: data.planId, status: 'TRIALING' },
      })
      return { userId: user.id, producerId: producer.id }
    })

    res.status(201).json(result)
  } catch (err) { next(err) }
}

export default router
