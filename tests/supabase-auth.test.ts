import { afterEach, describe, expect, it, vi } from 'vitest'
import { app } from '../api/app'
import { profileFromRow } from '../api/_lib/supabase'

const row = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  role: 'resident',
  status: 'active',
  display_name: 'Asha Rao',
  language: 'en',
  phone: null,
  notification_prefs: { inApp: true, email: false },
  created_at: '2026-10-13T00:00:00.000Z',
}

describe('Supabase profile mapping', () => {
  it('maps the database profile shape to the API profile contract', () => {
    expect(profileFromRow(row, 'asha@example.test')).toEqual({
      id: row.id,
      email: 'asha@example.test',
      role: 'resident',
      status: 'active',
      displayName: 'Asha Rao',
      language: 'en',
      phone: undefined,
      notificationPrefs: { inApp: true, email: false },
      createdAt: row.created_at,
    })
  })

  it('rejects malformed profile data instead of inventing defaults', () => {
    expect(() => profileFromRow({ ...row, role: 'admin', status: 'unexpected' })).toThrow(
      'Supabase returned an invalid profile',
    )
  })
})

describe('production API mode', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does not expose demo-only endpoints when demo mode is disabled', async () => {
    vi.stubEnv('DEMO_MODE', 'false')

    const response = await app.request('/api/cron/retention')
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.error.code).toBe('feature_not_configured')
  })
})
