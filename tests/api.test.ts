import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from '../api/app'
import { signDemo } from '../api/_lib/auth'
import { store } from '../api/_lib/store'
import type { RoutePlan, WasteReport } from '../shared/types'

const report = store.reports.find((item) => item.id === 'rep_001')!
let originalReport: WasteReport
let originalPlans: RoutePlan[]
let eventCount = 0

beforeEach(() => {
  vi.stubEnv('DEMO_MODE', 'true')
  originalReport = { ...report }
  originalPlans = [...store.plans]
  eventCount = store.events.length
  store.sessions = []
  store.stops = []
  store.plans = []
  store.actionResults.clear()
})

afterEach(() => {
  vi.unstubAllEnvs()
  Object.assign(report, originalReport)
  store.plans = originalPlans
  store.events.splice(eventCount)
  store.stops = []
  store.actionResults.clear()
  store.sessions = []
})

async function completeStop(token: string, idempotencyKey: string) {
  return app.request('/api/route-stops/test-stop/complete', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ outcome: 'completed', idempotencyKey }),
  })
}

describe('API authorization and worker actions', () => {
  it('prevents a resident from reading another resident report', async () => {
    report.reporterId = 'user_worker'
    const response = await app.request('/api/reports/rep_001', {
      headers: { authorization: `Bearer ${signDemo('user_resident')}` },
    })

    expect(response.status).toBe(403)
  })

  it('prevents a worker from completing a stop on another vehicle route', async () => {
    report.status = 'assigned'
    store.stops.push({
      id: 'test-stop',
      planId: 'test-plan',
      reportId: report.id,
      vehicleId: 'veh_2',
      sequence: 1,
      eta: new Date().toISOString(),
      serviceMinutes: 8,
      capacityUnits: 1,
      outcome: 'pending',
    })
    const response = await completeStop(signDemo('user_worker'), crypto.randomUUID())

    expect(response.status).toBe(403)
    expect(report.status).toBe('assigned')
  })

  it('does not expose a proposed route to a worker before dispatcher approval', async () => {
    store.plans.push({
      id: 'proposed-plan',
      date: '2026-10-13',
      shiftStart: '07:00',
      shiftEnd: '15:00',
      serviceAreaId: 'area_greenfield',
      algorithmVersion: 'test',
      status: 'proposed',
      metrics: {
        optimised: { distanceKm: 0, timeMin: 0, stopsServed: 0, constraintViolations: 0, runtimeMs: 0, unassigned: 0 },
        nearestNeighbour: { distanceKm: 0, timeMin: 0, stopsServed: 0, constraintViolations: 0, runtimeMs: 0, unassigned: 0 },
        original: { distanceKm: 0, timeMin: 0, stopsServed: 0, constraintViolations: 0, runtimeMs: 0, unassigned: 0 },
      },
      unassigned: [],
      createdAt: new Date().toISOString(),
    })
    const response = await app.request('/api/worker/route', {
      headers: { authorization: `Bearer ${signDemo('user_worker')}` },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ plan: null, stops: [] })
  })

  it('rounds route stop coordinates for analysts', async () => {
    store.plans.push({
      id: 'approved-plan',
      date: '2026-10-13',
      shiftStart: '07:00',
      shiftEnd: '15:00',
      serviceAreaId: 'area_greenfield',
      algorithmVersion: 'test',
      status: 'approved',
      metrics: {
        optimised: { distanceKm: 1, timeMin: 10, stopsServed: 1, constraintViolations: 0, runtimeMs: 1, unassigned: 0 },
        nearestNeighbour: { distanceKm: 1, timeMin: 10, stopsServed: 1, constraintViolations: 0, runtimeMs: 1, unassigned: 0 },
        original: { distanceKm: 1, timeMin: 10, stopsServed: 1, constraintViolations: 0, runtimeMs: 1, unassigned: 0 },
      },
      unassigned: [],
      createdAt: new Date().toISOString(),
    })
    store.stops.push({
      id: 'analyst-stop',
      planId: 'approved-plan',
      reportId: report.id,
      vehicleId: 'veh_1',
      sequence: 1,
      eta: new Date().toISOString(),
      serviceMinutes: 8,
      capacityUnits: 1,
      outcome: 'pending',
    })
    const response = await app.request('/api/routes/approved-plan', {
      headers: { authorization: `Bearer ${signDemo('user_analyst')}` },
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.stops[0].report.lat).toBe(Math.round(report.lat * 1000) / 1000)
    expect(body.stops[0].report.lng).toBe(Math.round(report.lng * 1000) / 1000)
  })

  it('applies completion once for retries with the same idempotency key', async () => {
    report.status = 'assigned'
    store.stops.push({
      id: 'test-stop',
      planId: 'test-plan',
      reportId: report.id,
      vehicleId: 'veh_1',
      sequence: 1,
      eta: new Date().toISOString(),
      serviceMinutes: 8,
      capacityUnits: 1,
      outcome: 'pending',
    })
    const token = signDemo('user_worker')
    const key = crypto.randomUUID()
    const first = await completeStop(token, key)
    const firstEventCount = store.events.length
    const retry = await completeStop(token, key)

    expect(first.status).toBe(200)
    expect(retry.status).toBe(200)
    expect(report.status).toBe('completed')
    expect(store.events.length).toBe(firstEventCount)
  })
})
