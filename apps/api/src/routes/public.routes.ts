import { Router } from 'express'
import { prisma } from '../config/prisma'
import { getSetting, SettingKeys } from '../services/settings.service'
import { registerProducer } from './producer.routes'

const router = Router()

// Public plans list (for landing page / pricing)
router.get('/plans', async (req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        type: true,
        priceMonthly: true,
        maxProperties: true,
        maxUsers: true,
        hasOcr: true,
        hasAiAgent: true,
        hasAutoDre: true,
        hasAlerts: true,
        hasWhitelabel: true,
        hasPrioritySupport: true,
        stripePriceId: true,
      },
      orderBy: { priceMonthly: 'asc' },
    })
    res.json(plans)
  } catch (err) {
    next(err)
  }
})

// Check if Stripe is configured (so frontend knows which flow to use)
router.get('/billing-mode', async (req, res, next) => {
  try {
    const stripeKey = await getSetting(SettingKeys.STRIPE_SECRET_KEY)
    const isStripeConfigured = !!stripeKey && stripeKey.length > 10
    res.json({ stripeEnabled: isStripeConfigured })
  } catch (err) {
    next(err)
  }
})

// Public registration
router.post('/register', registerProducer)

// ─── Price Index (public, aggregated — individual data never exposed) ──────────

// GET /api/public/price-index?category=FUEL&state=MT&product=Diesel+S10
router.get('/price-index', async (req, res, next) => {
  try {
    const { category, state, city, product } = req.query

    const where: any = {}
    if (category) where.category = String(category)
    if (state) where.state = String(state)
    if (city) where.city = String(city)
    if (product) where.product = { contains: String(product), mode: 'insensitive' }

    // Aggregate: average price per product+state in the last 90 days
    const since = new Date()
    since.setDate(since.getDate() - 90)
    where.date = { gte: since }

    const raw = await prisma.priceIndex.groupBy({
      by: ['product', 'category', 'state', 'city', 'unit'],
      where,
      _avg: { pricePerUnit: true },
      _min: { pricePerUnit: true },
      _max: { pricePerUnit: true },
      _count: { pricePerUnit: true },
      orderBy: { _avg: { pricePerUnit: 'asc' } },
    })

    const result = raw
      .filter((r) => (r._count.pricePerUnit ?? 0) >= 1) // at least 1 data point
      .map((r) => ({
        product: r.product,
        category: r.category,
        state: r.state,
        city: r.city,
        unit: r.unit,
        avgPrice: r._avg.pricePerUnit ? Number(r._avg.pricePerUnit.toFixed(4)) : null,
        minPrice: r._min.pricePerUnit ? Number(r._min.pricePerUnit.toFixed(4)) : null,
        maxPrice: r._max.pricePerUnit ? Number(r._max.pricePerUnit.toFixed(4)) : null,
        dataPoints: r._count.pricePerUnit,
      }))

    res.json(result)
  } catch (err) {
    next(err)
  }
})

// List available states & products in the index
router.get('/price-index/summary', async (req, res, next) => {
  try {
    const [states, products] = await Promise.all([
      prisma.priceIndex.groupBy({
        by: ['state'],
        _count: { state: true },
        orderBy: { _count: { state: 'desc' } },
      }),
      prisma.priceIndex.groupBy({
        by: ['product', 'category', 'unit'],
        _count: { product: true },
        orderBy: { _count: { product: 'desc' } },
        take: 50,
      }),
    ])

    res.json({
      states: states.map((s) => ({ state: s.state, count: s._count.state })),
      products: products.map((p) => ({
        product: p.product,
        category: p.category,
        unit: p.unit,
        count: p._count.product,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// ─── Price Index: list of suppliers with latest prices per product ────────────
// GET /api/public/price-index/suppliers?state=GO&product=Diesel
router.get('/price-index/suppliers', async (req, res, next) => {
  try {
    const { state, product, category } = req.query

    const where: any = { supplier: { not: null } }
    if (state) where.state = String(state)
    if (category) where.category = String(category)
    if (product) where.product = { contains: String(product), mode: 'insensitive' }

    // Get all records for known suppliers
    const records = await prisma.priceIndex.findMany({
      where,
      orderBy: { date: 'desc' },
      select: {
        id: true,
        supplier: true,
        supplierCnpj: true,
        product: true,
        category: true,
        pricePerUnit: true,
        unit: true,
        city: true,
        state: true,
        date: true,
      },
    })

    // Group by supplier → products → latest price
    const supplierMap = new Map<string, {
      supplier: string
      supplierCnpj: string | null
      city: string | null
      state: string
      products: Map<string, {
        product: string
        category: string
        unit: string | null
        latestPrice: number
        latestDate: Date
        priceCount: number
      }>
      lastUpdate: Date
    }>()

    for (const r of records) {
      const key = r.supplier!
      if (!supplierMap.has(key)) {
        supplierMap.set(key, {
          supplier: r.supplier!,
          supplierCnpj: r.supplierCnpj,
          city: r.city,
          state: r.state,
          products: new Map(),
          lastUpdate: r.date,
        })
      }
      const sup = supplierMap.get(key)!
      if (r.date > sup.lastUpdate) sup.lastUpdate = r.date

      const pKey = `${r.product}___${r.unit}`
      if (!sup.products.has(pKey)) {
        sup.products.set(pKey, {
          product: r.product,
          category: r.category,
          unit: r.unit,
          latestPrice: r.pricePerUnit,
          latestDate: r.date,
          priceCount: 1,
        })
      } else {
        const p = sup.products.get(pKey)!
        p.priceCount++
        // records are ordered by date desc, so first seen = latest
      }
    }

    const result = Array.from(supplierMap.values())
      .map((s) => ({
        supplier: s.supplier,
        supplierCnpj: s.supplierCnpj,
        city: s.city,
        state: s.state,
        lastUpdate: s.lastUpdate,
        products: Array.from(s.products.values()),
      }))
      .sort((a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime())

    res.json(result)
  } catch (err) {
    next(err)
  }
})

// ─── Price history for a specific supplier + product ─────────────────────────
// GET /api/public/price-index/history?supplier=Posto+Xará&product=Diesel+S10
router.get('/price-index/history', async (req, res, next) => {
  try {
    const { supplier, product } = req.query
    if (!supplier || !product) {
      return res.status(400).json({ error: 'supplier and product are required' })
    }

    const records = await prisma.priceIndex.findMany({
      where: {
        supplier: String(supplier),
        product: { contains: String(product), mode: 'insensitive' },
      },
      orderBy: { date: 'asc' },
      select: { date: true, pricePerUnit: true, city: true, state: true, unit: true, quantity: true },
    })

    res.json(records.map((r) => ({
      date: r.date,
      price: Number(r.pricePerUnit.toFixed(4)),
      city: r.city,
      state: r.state,
      unit: r.unit,
      quantity: r.quantity,
    })))
  } catch (err) {
    next(err)
  }
})

// ─── Support contact (public) ─────────────────────────────────────────────────
router.get('/support', async (req, res, next) => {
  try {
    const whatsapp = await getSetting(SettingKeys.SUPPORT_WHATSAPP)
    res.json({ whatsapp: whatsapp ?? null })
  } catch (err) {
    next(err)
  }
})

// ─── Price Index stats ────────────────────────────────────────────────────────
router.get('/price-index/stats', async (req, res, next) => {
  try {
    const [totalRecords, totalSuppliers, lastEntry] = await Promise.all([
      prisma.priceIndex.count(),
      prisma.priceIndex.groupBy({ by: ['supplier'], where: { supplier: { not: null } } }).then((r) => r.length),
      prisma.priceIndex.findFirst({ orderBy: { date: 'desc' }, select: { date: true } }),
    ])
    res.json({ totalRecords, totalSuppliers, lastUpdate: lastEntry?.date ?? null })
  } catch (err) {
    next(err)
  }
})

export default router
