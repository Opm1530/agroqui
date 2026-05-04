import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requireCooperative, AuthRequest } from '../middleware/auth'
import { prisma } from '../config/prisma'
import { hashPassword } from '../services/auth.service'
import { UserRole, HarvestStatus, EntryType } from '@prisma/client'

const router = Router()
router.use(authenticate, requireCooperative)

function getCooperativeId(req: AuthRequest): string {
  if (!req.user?.cooperativeId) throw new Error('Cooperative not found')
  return req.user.cooperativeId
}

// ─── Cooperative profile ──────────────────────────────────────────────────────

router.get('/profile', async (req: AuthRequest, res, next) => {
  try {
    const cooperativeId = getCooperativeId(req)
    const cooperative = await prisma.cooperative.findUnique({
      where: { id: cooperativeId },
      include: {
        plan: true,
        _count: { select: { producers: true } },
      },
    })
    res.json(cooperative)
  } catch (err) { next(err) }
})

router.put('/profile', async (req: AuthRequest, res, next) => {
  try {
    const cooperativeId = getCooperativeId(req)
    const schema = z.object({
      name: z.string().optional(),
      logoUrl: z.string().url().optional(),
      primaryColor: z.string().optional(),
    })
    const data = schema.parse(req.body)
    const cooperative = await prisma.cooperative.update({
      where: { id: cooperativeId },
      data,
    })
    res.json(cooperative)
  } catch (err) { next(err) }
})

// ─── Producers under this cooperative ────────────────────────────────────────

router.get('/producers', async (req: AuthRequest, res, next) => {
  try {
    const cooperativeId = getCooperativeId(req)
    const producers = await prisma.producer.findMany({
      where: { cooperativeId },
      include: {
        user: { select: { name: true, email: true, isActive: true } },
        subscriptions: {
          include: { plan: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: { select: { properties: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(producers)
  } catch (err) { next(err) }
})

router.post('/producers', async (req: AuthRequest, res, next) => {
  try {
    const cooperativeId = getCooperativeId(req)
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8),
      whatsapp: z.string().min(10),
      cpfCnpj: z.string().optional(),
      planId: z.string(),
    })
    const data = schema.parse(req.body)

    // Check cooperative's plan max users
    const cooperative = await prisma.cooperative.findUnique({
      where: { id: cooperativeId },
      include: { plan: true, _count: { select: { producers: true } } },
    })
    if (!cooperative) return res.status(404).json({ error: 'Cooperative not found' })
    if (cooperative._count.producers >= cooperative.plan.maxUsers) {
      return res.status(400).json({ error: `Producer limit reached (${cooperative.plan.maxUsers})` })
    }

    const passwordHash = await hashPassword(data.password)

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: data.name, email: data.email, passwordHash, role: UserRole.PRODUCER },
      })
      const producer = await tx.producer.create({
        data: { userId: user.id, whatsapp: data.whatsapp, cpfCnpj: data.cpfCnpj, cooperativeId },
      })
      await tx.subscription.create({
        data: { producerId: producer.id, planId: data.planId, status: 'ACTIVE' },
      })
      return { userId: user.id, producerId: producer.id }
    })

    res.status(201).json(result)
  } catch (err) { next(err) }
})

router.put('/producers/:id', async (req: AuthRequest, res, next) => {
  try {
    const cooperativeId = getCooperativeId(req)
    const schema = z.object({ isActive: z.boolean().optional() })
    const data = schema.parse(req.body)

    const producer = await prisma.producer.findFirst({
      where: { id: req.params.id, cooperativeId },
    })
    if (!producer) return res.status(404).json({ error: 'Producer not found' })

    await prisma.user.update({
      where: { id: producer.userId },
      data: { isActive: data.isActive },
    })
    res.json({ message: 'Updated' })
  } catch (err) { next(err) }
})

// ─── Consolidated dashboard ───────────────────────────────────────────────────

router.get('/dashboard', async (req: AuthRequest, res, next) => {
  try {
    const cooperativeId = getCooperativeId(req)

    const producers = await prisma.producer.findMany({
      where: { cooperativeId },
      select: { id: true },
    })
    const producerIds = producers.map((p) => p.id)

    const [activeHarvests, totalEntries, incomeSum, expenseSum, activeSubs] = await Promise.all([
      prisma.harvest.count({
        where: { property: { producerId: { in: producerIds } }, status: HarvestStatus.ACTIVE },
      }),
      prisma.entry.count({ where: { harvest: { property: { producerId: { in: producerIds } } } } }),
      prisma.entry.aggregate({
        where: { harvest: { property: { producerId: { in: producerIds } } }, type: EntryType.INCOME },
        _sum: { amount: true },
      }),
      prisma.entry.aggregate({
        where: { harvest: { property: { producerId: { in: producerIds } } }, type: EntryType.EXPENSE },
        _sum: { amount: true },
      }),
      prisma.subscription.count({
        where: { producerId: { in: producerIds }, status: 'ACTIVE' },
      }),
    ])

    res.json({
      totalProducers: producerIds.length,
      activeProducers: activeSubs,
      activeHarvests,
      totalEntries,
      totalIncome: incomeSum._sum.amount ?? 0,
      totalExpenses: expenseSum._sum.amount ?? 0,
    })
  } catch (err) { next(err) }
})

export default router
