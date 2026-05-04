import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { prisma } from '../config/prisma'
import { UserRole } from '@prisma/client'

export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    role: UserRole
    producerId?: string
    cooperativeId?: string
  }
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'No token provided' })

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthRequest['user']
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    next()
  }
}

export const requireAdmin = requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export const requireSuperAdmin = requireRole(UserRole.SUPER_ADMIN)
export const requireCooperative = requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COOPERATIVE)
