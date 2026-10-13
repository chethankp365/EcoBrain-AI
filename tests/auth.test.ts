import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readDemo, signDemo } from '../api/_lib/auth'
import { store } from '../api/_lib/store'

describe('demo sessions', () => {
  beforeEach(() => {
    store.sessions = []
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses an opaque unguessable token tied to its server-side user', () => {
    const token = signDemo('user_resident')

    expect(token).not.toContain('user_resident')
    expect(readDemo(token)).toBe('user_resident')
    expect(readDemo(signDemo('user_admin'))).toBe('user_admin')
  })

  it('rejects forged tokens and sessions older than seven days', () => {
    const forged = Buffer.from(JSON.stringify({ userId: 'user_admin', s: 'ecobrain-demo-token', t: Date.now() })).toString('base64url')
    expect(readDemo(forged)).toBeNull()

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-13T00:00:00Z'))
    const token = signDemo('user_resident')
    vi.setSystemTime(new Date('2026-10-20T00:00:01Z'))
    expect(readDemo(token)).toBeNull()
  })
})
