import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../config/prisma'
import { env } from '../config/env'
import { UserRole } from '@prisma/client'

interface TokenPayload {
  id: string
  email: string
  role: UserRole
  producerId?: string
  cooperativeId?: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions)
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      producer: true,
      cooperative: true,
    },
  })

  if (!user || !user.isActive) throw new Error('Invalid credentials')

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) throw new Error('Invalid credentials')

  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role,
    producerId: user.producer?.id,
    cooperativeId: user.cooperative?.id,
  })

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      producerId: user.producer?.id,
      cooperativeId: user.cooperative?.id,
    },
  }
}

export async function createAdminUser(data: {
  name: string
  email: string
  password: string
  role?: UserRole
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } })
  if (existing) throw new Error('Email already in use')

  const passwordHash = await hashPassword(data.password)

  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role ?? UserRole.ADMIN,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })
}
