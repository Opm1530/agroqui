'use client'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'SUPER_ADMIN' | 'ADMIN' | 'COOPERATIVE' | 'PRODUCER'
  producerId?: string
  cooperativeId?: string
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('cdc_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setAuth(token: string, user: AuthUser) {
  localStorage.setItem('cdc_token', token)
  localStorage.setItem('cdc_user', JSON.stringify(user))
}

export function clearAuth() {
  localStorage.removeItem('cdc_token')
  localStorage.removeItem('cdc_user')
}

export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
}

export function isCooperative(user: AuthUser | null): boolean {
  return user?.role === 'COOPERATIVE' || isAdmin(user)
}

export function isProducer(user: AuthUser | null): boolean {
  return user?.role === 'PRODUCER'
}

export function getDashboardPath(user: AuthUser | null): string {
  if (!user) return '/login'
  if (isAdmin(user)) return '/admin'
  if (isCooperative(user)) return '/cooperative'
  return '/dashboard'
}
