import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Profile, UserRole } from '@shared/types'
import { api, getToken, setSession, setToken } from './api'

type Auth = {
  profile: Profile | null
  loading: boolean
  login: (email: string, password: string) => Promise<Profile>
  signup: (email: string, password: string, displayName: string) => Promise<Profile | null>
  logout: () => Promise<void>
  demo: (role: UserRole) => Promise<Profile>
}

const Ctx = createContext<Auth | null>(null)

const DEMO: Record<UserRole, string> = {
  resident: 'resident@ecobrain.demo',
  worker: 'worker@ecobrain.demo',
  dispatcher: 'dispatcher@ecobrain.demo',
  admin: 'admin@ecobrain.demo',
  analyst: 'analyst@ecobrain.demo',
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    api<Profile>('/me')
      .then(setProfile)
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo<Auth>(
    () => ({
      profile,
      loading,
      async login(email, password) {
        const r = await api<{ token: string; refreshToken?: string; profile: Profile }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
        setSession(r.token, r.refreshToken)
        setProfile(r.profile)
        return r.profile
      },
      async signup(email, password, displayName) {
        const r = await api<{ token?: string; refreshToken?: string; profile?: Profile; requiresEmailConfirmation?: boolean }>('/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ email, password, displayName }),
        })
        if (!r.token || !r.profile) return null
        setSession(r.token, r.refreshToken)
        setProfile(r.profile)
        return r.profile
      },
      async logout() {
        try {
          if (getToken()) await api('/auth/logout', { method: 'POST' })
        } finally {
          setToken(null)
          setProfile(null)
        }
      },
      async demo(role) {
        const r = await api<{ token: string; profile: Profile }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: DEMO[role], password: 'EcoBrain!2026' }),
        })
        setToken(r.token)
        setProfile(r.profile)
        return r.profile
      },
    }),
    [profile, loading],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('AuthProvider missing')
  return v
}

export function homeFor(role: UserRole) {
  return {
    resident: '/my-reports',
    worker: '/worker',
    dispatcher: '/dispatch',
    admin: '/admin',
    analyst: '/analytics',
  }[role]
}
