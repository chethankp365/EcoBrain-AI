import type { Context, Next } from 'hono'
import { randomBytes } from 'node:crypto'
import { env } from './env'
import { apiError } from './errors'
import { store } from './store'
import type { Profile, UserRole } from '../../shared/types'

export function signDemo(userId: string) {
  const token = randomBytes(32).toString('base64url')
  store.sessions.push({ token, userId, createdAt: Date.now() })
  return token
}

export function readDemo(token: string): string | null {
  const maxAge = 7 * 24 * 60 * 60 * 1000
  const session = store.sessions.find((item) => item.token === token)
  if (!session || Date.now() - session.createdAt > maxAge) return null
  return session.userId
}

export async function authMiddleware(c: Context, next: Next) {
  if (c.req.method === 'OPTIONS') return next()
  const path = new URL(c.req.url).pathname
  const open =
    path === '/api/health' ||
    path === '/api/auth/login' ||
    path === '/api/auth/signup' ||
    path === '/api/auth/forgot' ||
    path.startsWith('/api/docs') ||
    path.startsWith('/api/cron/')
  if (open) return next()

  const header = c.req.header('authorization') || ''
  const token = header.replace(/^Bearer\s+/i, '')
  if (!token) throw apiError(401, 'unauthenticated', 'Sign in required')
  const userId = readDemo(token)
  const profile = store.profiles.find((p) => p.id === userId)
  if (!profile) throw apiError(401, 'unauthenticated', 'Invalid session')
  if (profile.status === 'suspended') throw apiError(403, 'suspended', 'Account suspended')
  c.set('profile', profile)
  return next()
}

export function requireRole(...roles: UserRole[]) {
  return async (c: Context, next: Next) => {
    const profile = c.get('profile') as Profile | undefined
    if (!profile) throw apiError(401, 'unauthenticated', 'Sign in required')
    if (!roles.includes(profile.role)) throw apiError(403, 'forbidden', 'Insufficient role')
    return next()
  }
}

export function demoLogin(email: string, password: string) {
  if (!env().demoMode) throw apiError(503, 'auth_unavailable', 'Configure Supabase Auth before disabling demo mode')
  const profile = store.profiles.find((p) => p.email.toLowerCase() === email.toLowerCase())
  if (!profile || store.passwords.get(profile.email.toLowerCase()) !== password) {
    throw apiError(401, 'invalid_credentials', 'Wrong email or password')
  }
  if (profile.status === 'suspended') throw apiError(403, 'suspended', 'Account suspended')
  return { token: signDemo(profile.id), profile }
}
