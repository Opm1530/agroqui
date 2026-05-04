import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import { prisma } from '../config/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { getSetting, SettingKeys } from '../services/settings.service'

const router = Router()

async function getStripe(): Promise<Stripe> {
  const key = await getSetting(SettingKeys.STRIPE_SECRET_KEY)
  if (!key) throw new Error('Stripe not configured. Add your Stripe secret key in Admin > Settings.')
  return new Stripe(key, { apiVersion: '2024-06-20' })
}

// Create checkout session
router.post('/checkout', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const stripe = await getStripe()
    const { planId, successUrl, cancelUrl } = req.body

    const plan = await prisma.plan.findUnique({ where: { id: planId } })
    if (!plan?.stripePriceId) return res.status(400).json({ error: 'Plan has no Stripe price configured' })

    const producer = req.user?.producerId
      ? await prisma.producer.findUnique({
          where: { id: req.user.producerId },
          include: { subscriptions: { where: { stripeCustomerId: { not: null } }, take: 1 } },
        })
      : null

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: successUrl ?? `${process.env.FRONTEND_URL}/dashboard?payment=success`,
      cancel_url: cancelUrl ?? `${process.env.FRONTEND_URL}/plans?payment=cancel`,
      customer: producer?.subscriptions[0]?.stripeCustomerId ?? undefined,
      metadata: {
        planId,
        producerId: req.user?.producerId ?? '',
        cooperativeId: req.user?.cooperativeId ?? '',
      },
    })

    res.json({ url: session.url })
  } catch (err) { next(err) }
})

// Customer portal
router.post('/portal', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const stripe = await getStripe()
    const sub = await prisma.subscription.findFirst({
      where: {
        OR: [
          { producerId: req.user?.producerId },
          { cooperativeId: req.user?.cooperativeId },
        ],
        stripeCustomerId: { not: null },
      },
    })
    if (!sub?.stripeCustomerId) return res.status(400).json({ error: 'No active Stripe subscription' })

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/dashboard`,
    })
    res.json({ url: session.url })
  } catch (err) { next(err) }
})

// Stripe webhook
router.post('/webhook', async (req: Request, res: Response) => {
  const webhookSecret = await getSetting(SettingKeys.STRIPE_WEBHOOK_SECRET)
  const signature = req.headers['stripe-signature'] as string

  let event: Stripe.Event

  try {
    const stripe = await getStripe()
    event = stripe.webhooks.constructEvent(req.body as Buffer, signature, webhookSecret ?? '')
  } catch (err) {
    return res.status(400).json({ error: 'Webhook signature invalid' })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.CheckoutSession
        const { planId, producerId, cooperativeId } = session.metadata ?? {}
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string

        await prisma.subscription.updateMany({
          where: {
            OR: [
              { producerId: producerId || undefined },
              { cooperativeId: cooperativeId || undefined },
            ],
            planId,
          },
          data: {
            status: 'ACTIVE',
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
          },
        })
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const subId = invoice.subscription as string
        const sub = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: subId } })
        if (sub) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'ACTIVE' },
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subId = invoice.subscription as string
        const sub = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: subId } })
        if (sub) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'PAST_DUE' },
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: { status: 'CANCELED' },
        })
        break
      }
    }

    res.json({ received: true })
  } catch (err) {
    console.error('Stripe webhook handler error:', err)
    res.status(500).json({ error: 'Webhook handler failed' })
  }
})

export default router
