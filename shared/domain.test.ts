import { describe, expect, it } from 'vitest'
import { findDuplicates } from './duplicates'
import { scorePriority } from './priority'
import { assertTransition, canApproveRoutes, IllegalTransitionError } from './transitions'
import type { SystemSettings } from './types'

const settings: SystemSettings = {
  aiThreshold: 0.65,
  priorityWeights: { category: 10, age: 10, sensitive: 10, repeat: 10, fill: 10 },
  fuelPerKmL: 0.22,
  emissionKgPerL: 2.68,
  retentionDays: 90,
  duplicateRadiusM: 50,
  duplicateWindowHours: 72,
}

describe('report domain rules', () => {
  it('allows only roles authorized for a report transition', () => {
    expect(() => assertTransition('assigned', 'in_progress', 'worker')).not.toThrow()
    expect(() => assertTransition('pending_assignment', 'assigned', 'worker')).toThrow(IllegalTransitionError)
  })

  it('limits route approval to dispatchers and admins', () => {
    expect(canApproveRoutes('dispatcher')).toBe(true)
    expect(canApproveRoutes('admin')).toBe(true)
    expect(canApproveRoutes('worker')).toBe(false)
  })

  it('scores priority transparently and caps the score', () => {
    const result = scorePriority({
      category: 'overflowing_bin',
      createdAt: '2026-10-01T00:00:00.000Z',
      now: new Date('2026-10-13T00:00:00.000Z'),
      lat: 12.97,
      lng: 77.59,
      sensitive: [],
      repeatCount72h: 5,
      fillLevel: 100,
      settings,
    })

    expect(result.score).toBe(96)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.label).toBe('urgent')
    expect(result.factors).toHaveLength(5)
  })

  it('returns nearby related reports as duplicate suggestions', () => {
    const candidates = [{
      id: 'report-1',
      code: 'EB-2026-000001',
      category: 'overflowing_bin' as const,
      lat: 12.9716,
      lng: 77.5946,
      createdAt: '2026-10-13T11:00:00.000Z',
      status: 'submitted' as const,
    }]
    const suggestions = findDuplicates({
      category: 'missed_collection',
      lat: 12.9716,
      lng: 77.5946,
      now: new Date('2026-10-13T12:00:00.000Z'),
      candidates,
    })

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].reportId).toBe('report-1')
  })
})
