import { Router } from 'express'
import { z } from 'zod'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requireActiveSubscription } from '../middleware/subscription'
import { prisma } from '../config/prisma'
import { EntryCategory, EntryType, HarvestStatus, ActivityType, ProductUnit } from '@prisma/client'
import { hashPassword } from '../services/auth.service'
import { UserRole } from '@prisma/client'

const router = Router()

// POST /producer/select-plan — for users who registered without a plan
// Must be registered BEFORE requireActiveSubscription middleware
router.post('/select-plan', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { planId } = req.body
    const plan = await prisma.plan.findUnique({ where: { id: planId, isActive: true } })
    if (!plan) return res.status(404).json({ error: 'Plano não encontrado' })

    const producer = await prisma.producer.findUnique({ where: { userId: req.user!.id } })
    if (!producer) return res.status(404).json({ error: 'Producer not found' })

    // Check if already has subscription
    const existing = await prisma.subscription.findFirst({ where: { producerId: producer.id } })
    if (existing) {
      // Update plan
      const updated = await prisma.subscription.update({ where: { id: existing.id }, data: { planId, status: 'TRIALING' } })
      return res.json(updated)
    }

    const subscription = await prisma.subscription.create({
      data: { producerId: producer.id, planId, status: 'TRIALING' }
    })
    res.json(subscription)
  } catch (err) { next(err) }
})

router.use(authenticate)
router.use(requireActiveSubscription)

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
        property: { select: { id: true, name: true } },
        harvestPlots: { include: { plot: { select: { id: true, name: true, hectares: true } } } },
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

router.delete('/harvests/:id', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const harvest = await prisma.harvest.findFirst({
      where: { id: req.params.id, property: { producerId } },
    })
    if (!harvest) return res.status(404).json({ error: 'Harvest not found' })
    // Remove child records that don't have cascade configured
    await prisma.entry.deleteMany({ where: { harvestId: req.params.id } })
    await prisma.activity.deleteMany({ where: { harvestId: req.params.id } })
    await prisma.harvest.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// ─── HarvestPlots (talhões vinculados à safra) ───────────────────────────────

router.get('/harvests/:id/plots', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const harvest = await prisma.harvest.findFirst({ where: { id: req.params.id, property: { producerId } } })
    if (!harvest) return res.status(404).json({ error: 'Harvest not found' })
    const items = await prisma.harvestPlot.findMany({
      where: { harvestId: req.params.id },
      include: { plot: { select: { id: true, name: true, hectares: true, color: true } } },
    })
    res.json(items)
  } catch (err) { next(err) }
})

router.post('/harvests/:id/plots', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const harvest = await prisma.harvest.findFirst({ where: { id: req.params.id, property: { producerId } } })
    if (!harvest) return res.status(404).json({ error: 'Harvest not found' })
    const schema = z.object({
      plotId: z.string(),
      hectares: z.number().positive().optional(),
    })
    const data = schema.parse(req.body)
    // Verify plot belongs to same property
    const plot = await prisma.plot.findFirst({ where: { id: data.plotId, propertyId: harvest.propertyId } })
    if (!plot) return res.status(404).json({ error: 'Plot not found' })
    const hp = await prisma.harvestPlot.upsert({
      where: { harvestId_plotId: { harvestId: req.params.id, plotId: data.plotId } },
      create: { harvestId: req.params.id, plotId: data.plotId, hectares: data.hectares },
      update: { hectares: data.hectares },
    })
    res.status(201).json(hp)
  } catch (err) { next(err) }
})

router.delete('/harvests/:id/plots/:plotId', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const harvest = await prisma.harvest.findFirst({ where: { id: req.params.id, property: { producerId } } })
    if (!harvest) return res.status(404).json({ error: 'Harvest not found' })
    await prisma.harvestPlot.deleteMany({ where: { harvestId: req.params.id, plotId: req.params.plotId } })
    res.status(204).send()
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
      include: {
        property: true,
        harvestPlots: { include: { plot: { select: { id: true, name: true, hectares: true, boundary: true, color: true } } } },
      },
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

    // Cost per hectare — prefer sum of harvestPlot hectares, fallback to property
    const harvestHectares = harvest.harvestPlots.reduce((s, hp) => s + (hp.hectares ?? hp.plot.hectares ?? 0), 0)
    const hectares = harvestHectares || harvest.property.hectares || 1
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
        plots: harvest.harvestPlots.map((hp) => hp.plot),
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
  whatsapp: z.string(),
  cpfCnpj: z.string().optional(),
  planId: z.string().optional(),
  cooperativeId: z.string().optional(),
})

// This is public — no auth middleware applied at route level
export async function registerProducer(req: any, res: any, next: any) {
  try {
    const data = registerSchema.parse(req.body)

    // Normalize: strip everything except digits
    const whatsapp = data.whatsapp.replace(/\D/g, '')
    // Accept 13-digit (55+DDD+9+8) and 12-digit (55+DDD+8) Brazilian numbers.
    // Some regions/carriers still operate without the 9th digit on WhatsApp.
    const valid13 = /^55\d{2}9\d{8}$/.test(whatsapp) // new format: 5541999999999
    const valid12 = /^55\d{2}\d{8}$/.test(whatsapp)   // old format: 554199999999
    if (!valid13 && !valid12) {
      return res.status(400).json({
        error: 'WhatsApp inválido. Use o formato com DDI: 5511999999999 (55 + DDD + número)'
      })
    }

    let plan = null
    if (data.planId) {
      plan = await prisma.plan.findUnique({ where: { id: data.planId, isActive: true } })
      if (!plan) return res.status(404).json({ error: 'Plano não encontrado' })
    }

    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) return res.status(400).json({ error: 'Email already in use' })

    const existingWa = await prisma.producer.findUnique({ where: { whatsapp } })
    if (existingWa) return res.status(400).json({ error: 'Este WhatsApp já está cadastrado' })

    const passwordHash = await hashPassword(data.password)

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: data.name, email: data.email, passwordHash, role: UserRole.PRODUCER },
      })
      const producer = await tx.producer.create({
        data: { userId: user.id, whatsapp, cpfCnpj: data.cpfCnpj, cooperativeId: data.cooperativeId },
      })
      if (plan && data.planId) {
        await tx.subscription.create({
          data: { producerId: producer.id, planId: data.planId, status: 'TRIALING' },
        })
      }
      return { userId: user.id, producerId: producer.id }
    })

    res.status(201).json(result)
  } catch (err) { next(err) }
}

// ─── Products (catálogo de produtos) ─────────────────────────────────────────

router.get('/products', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const products = await prisma.product.findMany({
      where: { producerId, isActive: true },
      orderBy: { name: 'asc' },
    })
    res.json(products)
  } catch (err) { next(err) }
})

router.post('/products', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const schema = z.object({
      name: z.string().min(1),
      unit: z.nativeEnum(ProductUnit),
      category: z.nativeEnum(EntryCategory),
    })
    const data = schema.parse(req.body)
    const product = await prisma.product.create({ data: { ...data, producerId } })
    res.status(201).json(product)
  } catch (err) { next(err) }
})

router.put('/products/:id', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const schema = z.object({
      name: z.string().min(1).optional(),
      unit: z.nativeEnum(ProductUnit).optional(),
      category: z.nativeEnum(EntryCategory).optional(),
      isActive: z.boolean().optional(),
    })
    const data = schema.parse(req.body)
    const product = await prisma.product.findFirst({ where: { id: req.params.id, producerId } })
    if (!product) return res.status(404).json({ error: 'Product not found' })
    const updated = await prisma.product.update({ where: { id: req.params.id }, data })
    res.json(updated)
  } catch (err) { next(err) }
})

// ─── Stock ────────────────────────────────────────────────────────────────────

router.get('/stock', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const { propertyId } = req.query
    const items = await prisma.stockItem.findMany({
      where: { producerId, ...(propertyId ? { propertyId: String(propertyId) } : {}) },
      include: {
        product: true,
        property: { select: { id: true, name: true } },
      },
      orderBy: { product: { name: 'asc' } },
    })
    res.json(items)
  } catch (err) { next(err) }
})

// Entrada manual de estoque
router.post('/stock/entry', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const schema = z.object({
      productId: z.string(),
      propertyId: z.string(),
      quantity: z.number().positive(),
      unitCost: z.number().positive().optional(),
      date: z.string(),
      note: z.string().optional(),
    })
    const data = schema.parse(req.body)
    const product = await prisma.product.findFirst({ where: { id: data.productId, producerId } })
    if (!product) return res.status(404).json({ error: 'Product not found' })
    const property = await prisma.property.findFirst({ where: { id: data.propertyId, producerId } })
    if (!property) return res.status(404).json({ error: 'Property not found' })

    const result = await prisma.$transaction(async (tx) => {
      const stockItem = await tx.stockItem.upsert({
        where: { producerId_productId_propertyId: { producerId, productId: data.productId, propertyId: data.propertyId } },
        create: { producerId, productId: data.productId, propertyId: data.propertyId, quantity: data.quantity },
        update: { quantity: { increment: data.quantity } },
      })
      const movement = await tx.stockMovement.create({
        data: {
          stockItemId: stockItem.id,
          type: 'IN',
          quantity: data.quantity,
          unitCost: data.unitCost,
          date: new Date(data.date),
          note: data.note,
        },
      })
      return { stockItem, movement }
    })
    res.status(201).json(result)
  } catch (err) { next(err) }
})

router.get('/stock/movements', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const { productId, propertyId } = req.query
    const movements = await prisma.stockMovement.findMany({
      where: {
        stockItem: {
          producerId,
          ...(productId ? { productId: String(productId) } : {}),
          ...(propertyId ? { propertyId: String(propertyId) } : {}),
        },
      },
      include: {
        stockItem: { include: { product: true, property: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
      take: 100,
    })
    res.json(movements)
  } catch (err) { next(err) }
})

// ─── Activities (atividades da safra) ────────────────────────────────────────

router.get('/activities', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const { harvestId, plotId } = req.query
    const where: any = { harvest: { property: { producerId } } }
    if (harvestId) where.harvestId = String(harvestId)
    if (plotId) where.plotId = String(plotId)
    const activities = await prisma.activity.findMany({
      where,
      include: {
        harvest: { select: { crop: true, year: true } },
        plot: { select: { name: true } },
        items: { include: { product: true } },
      },
      orderBy: { date: 'desc' },
    })
    res.json(activities)
  } catch (err) { next(err) }
})

router.post('/activities', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const schema = z.object({
      harvestId: z.string(),
      plotId: z.string().optional(),
      type: z.nativeEnum(ActivityType),
      date: z.string(),
      hectares: z.number().positive().optional(),
      notes: z.string().optional(),
      items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().positive(),
        unit: z.nativeEnum(ProductUnit),
      })).optional(),
    })
    const data = schema.parse(req.body)
    const harvest = await prisma.harvest.findFirst({ where: { id: data.harvestId, property: { producerId } } })
    if (!harvest) return res.status(404).json({ error: 'Harvest not found' })

    const result = await prisma.$transaction(async (tx) => {
      const activity = await tx.activity.create({
        data: {
          harvestId: data.harvestId,
          plotId: data.plotId,
          type: data.type,
          date: new Date(data.date),
          hectares: data.hectares,
          notes: data.notes,
          items: data.items?.length
            ? { create: data.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unit: i.unit })) }
            : undefined,
        },
        include: { items: { include: { product: true } }, plot: { select: { name: true } } },
      })

      // Deduzir produtos do estoque
      if (data.items?.length) {
        for (const item of data.items) {
          const stockItem = await tx.stockItem.findFirst({
            where: { producerId, productId: item.productId, propertyId: harvest.propertyId },
          })
          if (stockItem) {
            await tx.stockItem.update({
              where: { id: stockItem.id },
              data: { quantity: { decrement: item.quantity } },
            })
            await tx.stockMovement.create({
              data: {
                stockItemId: stockItem.id,
                type: 'OUT',
                quantity: item.quantity,
                date: new Date(data.date),
                activityId: activity.id,
                note: `Atividade: ${data.type}`,
              },
            })
          }
        }
      }
      return activity
    })
    res.status(201).json(result)
  } catch (err) { next(err) }
})

router.delete('/activities/:id', async (req: AuthRequest, res, next) => {
  try {
    const producerId = getProducerId(req)
    const activity = await prisma.activity.findFirst({
      where: { id: req.params.id, harvest: { property: { producerId } } },
      include: { items: true, harvest: true },
    })
    if (!activity) return res.status(404).json({ error: 'Activity not found' })

    await prisma.$transaction(async (tx) => {
      // Reverter estoque
      for (const item of activity.items) {
        const stockItem = await tx.stockItem.findFirst({
          where: { producerId, productId: item.productId, propertyId: activity.harvest.propertyId },
        })
        if (stockItem) {
          await tx.stockItem.update({
            where: { id: stockItem.id },
            data: { quantity: { increment: item.quantity } },
          })
          await tx.stockMovement.deleteMany({ where: { activityId: activity.id } })
        }
      }
      await tx.activity.delete({ where: { id: req.params.id } })
    })
    res.status(204).send()
  } catch (err) { next(err) }
})

export default router
