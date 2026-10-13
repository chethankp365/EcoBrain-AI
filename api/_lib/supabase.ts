import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { ACCOUNT_STATUSES, USER_ROLES, type Profile } from '../../shared/types'
import { apiError } from './errors'
import { env, usingSupabase } from './env'

const profileRowSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(USER_ROLES),
  status: z.enum(ACCOUNT_STATUSES),
  display_name: z.string(),
  email: z.string().email().optional(),
  language: z.enum(['en', 'hi', 'kn']),
  phone: z.string().nullable().optional(),
  notification_prefs: z.object({ inApp: z.boolean(), email: z.boolean() }),
  created_at: z.string(),
})

let adminClient: { url: string; key: string; client: SupabaseClient } | undefined
let authClient: { url: string; key: string; client: SupabaseClient } | undefined

function clientFor(key: string, cache: typeof adminClient): SupabaseClient {
  const e = env()
  if (!e.supabaseUrl || !key) {
    throw apiError(503, 'supabase_not_configured', 'Supabase server configuration is incomplete')
  }
  if (cache?.url === e.supabaseUrl && cache.key === key) return cache.client
  return createClient(e.supabaseUrl, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  })
}

export function supabaseAdmin(): SupabaseClient {
  if (!usingSupabase()) throw apiError(503, 'supabase_not_configured', 'Supabase server configuration is incomplete')
  const e = env()
  if (adminClient?.url === e.supabaseUrl && adminClient.key === e.serviceRole) return adminClient.client
  const client = clientFor(e.serviceRole, adminClient)
  adminClient = { url: e.supabaseUrl, key: e.serviceRole, client }
  return client
}

export function supabaseAuth(): SupabaseClient {
  const e = env()
  if (!e.supabaseUrl || !e.supabaseAnon) {
    throw apiError(503, 'supabase_not_configured', 'Supabase Auth configuration is incomplete')
  }
  if (authClient?.url === e.supabaseUrl && authClient.key === e.supabaseAnon) return authClient.client
  const client = clientFor(e.supabaseAnon, authClient)
  authClient = { url: e.supabaseUrl, key: e.supabaseAnon, client }
  return client
}

export function profileFromRow(value: unknown, email?: string): Profile {
  const row = profileRowSchema.safeParse(value)
  if (!row.success) throw apiError(503, 'invalid_profile', 'Supabase returned an invalid profile')
  return {
    id: row.data.id,
    email: row.data.email ?? email ?? '',
    role: row.data.role,
    status: row.data.status,
    displayName: row.data.display_name,
    language: row.data.language,
    phone: row.data.phone ?? undefined,
    notificationPrefs: row.data.notification_prefs,
    createdAt: row.data.created_at,
  }
}

export async function supabaseProfileForToken(token: string): Promise<Profile> {
  const client = supabaseAdmin()
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) throw apiError(401, 'unauthenticated', 'Invalid or expired Supabase session')

  const { data: row, error: profileError } = await client
    .from('profiles')
    .select('id, role, status, display_name, language, phone, notification_prefs, created_at')
    .eq('id', data.user.id)
    .maybeSingle()

  if (profileError) throw apiError(503, 'profile_unavailable', 'Could not load the account profile from Supabase')
  if (!row) throw apiError(403, 'profile_missing', 'The authenticated account has no EcoBrain profile')

  const profile = profileFromRow(row, data.user.email)
  if (profile.status === 'suspended') throw apiError(403, 'suspended', 'Account suspended')
  if (profile.status !== 'active') throw apiError(403, 'inactive', 'Account is not active')
  return profile
}
