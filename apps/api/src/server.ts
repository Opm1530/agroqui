import './config/env' // load & validate env first
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { env } from './config/env'
import { errorHandler } from './middleware/error'

// Routes
import authRoutes from './routes/auth.routes'
import adminRoutes from './routes/admin.routes'
import producerRoutes from './routes/producer.routes'
import publicRoutes from './routes/public.routes'
import cooperativeRoutes from './routes/cooperative.routes'
import webhookRoutes from './routes/webhook.routes'
import stripeRoutes from './routes/stripe.routes'

const app = express()

// Trust reverse proxy (nginx, ngrok, Cloudflare, etc.)
app.set('trust proxy', 1)

// Stripe webhook needs raw body
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }))

app.use(helmet())
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }))
app.use(express.json({ limit: '10mb' }))

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false })
app.use(limiter)

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/producer', producerRoutes)
app.use('/api/public', publicRoutes)
app.use('/api/cooperative', cooperativeRoutes)
app.use('/api/webhook', webhookRoutes)
app.use('/api/stripe', stripeRoutes)

// Error handler
app.use(errorHandler)

const port = Number(env.PORT)
app.listen(port, () => {
  console.log(`🚜 Contador do Campo API running on port ${port}`)
})

export default app
