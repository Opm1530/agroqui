import { Router } from 'express'
import { z } from 'zod'
import { loginUser } from '../services/auth.service'
import { authenticate } from '../middleware/auth'
import { AuthRequest } from '../middleware/auth'

const router = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body)
    const result = await loginUser(email, password)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    res.json({ user: req.user })
  } catch (err) {
    next(err)
  }
})

export default router
