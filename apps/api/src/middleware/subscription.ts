import { Response, NextFunction } from 'express'
import { prisma } from '../config/prisma'
import { getSetting, SettingKeys } from '../services/settings.service'
import { AuthRequest } from './auth'

export async function requireActiveSubscription(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const role = req.user?.role

    // Admins are always allowed
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      return next()
    }

    // If Stripe is not configured, treat as trial mode and allow all
    const stripeKey = await getSetting(SettingKeys.STRIPE_SECRET_KEY)
    if (!stripeKey || stripeKey.length < 10) {
      return next()
    }

    let status: string | null = null

    if (role === 'PRODUCER') {
      const producer = await prisma.producer.findUnique({
        where: { userId: req.user!.id },
        include: {
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      })
      status = producer?.subscriptions[0]?.status ?? null
    } else if (role === 'COOPERATIVE') {
      const cooperative = await prisma.cooperative.findUnique({
        where: { userId: req.user!.id },
        include: {
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      })
      status = cooperative?.subscriptions[0]?.status ?? null
    }

    if (status === 'ACTIVE' || status === 'TRIALING' || status === 'COMPLIMENTARY') {
      return next()
    }

    if (status === 'PAST_DUE') {
      return res.status(402).json({
        error: 'Pagamento em atraso. Atualize seu método de pagamento.',
        code: 'PAST_DUE',
      })
    }

    // No subscription found — let through; frontend handles UI locks via PlanGuard
    if (status === null) {
      return next()
    }

    // CANCELED or INACTIVE — block only when Stripe is active
    return res.status(402).json({
      error: 'Assinatura inativa. Renove seu plano para continuar.',
      code: 'SUBSCRIPTION_REQUIRED',
    })
  } catch (err) {
    next(err)
  }
}
