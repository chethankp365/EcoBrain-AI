import { haversineM } from '../priority'
import type { Category, RouteMetrics } from '../types'

export type SolverStop = {
  id: string
  lat: number
  lng: number
  demand: number
  serviceMin: number
  priorityWeight: number
  deadlineMin: number
  category: Category
}

export type SolverVehicle = {
  id: string
  capacity: number
  shiftMin: number
  acceptedCategories: Category[]
  restrictions: string[]
}

export type Matrix = { time: number[][]; dist: number[][]; approximate: boolean }

export type BuiltRoute = {
  vehicleId: string
  stopIds: string[]
  timeMin: number
  distanceKm: number
  etas: number[]
}

export type SolverOutput = {
  routes: BuiltRoute[]
  unassigned: { id: string; reason: string }[]
  metrics: RouteMetrics
  objective: number
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function haversineMatrix(points: { lat: number; lng: number }[]): Matrix {
  const n = points.length
  const time = Array.from({ length: n }, () => Array(n).fill(0))
  const dist = Array.from({ length: n }, () => Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      const m = haversineM(points[i], points[j]) * 1.3
      dist[i][j] = m / 1000
      time[i][j] = (m / 1000 / 25) * 60
    }
  }
  return { time, dist, approximate: true }
}

function objective(routes: BuiltRoute[], unassigned: number, latePenalty: number) {
  const travel = routes.reduce((s, r) => s + r.timeMin, 0)
  const balance = routes.length
    ? Math.max(...routes.map((r) => r.timeMin)) - Math.min(...routes.map((r) => r.timeMin))
    : 0
  return travel + latePenalty * 8 + unassigned * 400 + balance * 0.15
}

function routeCost(
  seq: number[],
  vehicle: SolverVehicle,
  stops: SolverStop[],
  matrix: Matrix,
): { ok: boolean; time: number; dist: number; late: number; etas: number[]; reason?: string } {
  let t = 0
  let d = 0
  let load = 0
  let late = 0
  const etas: number[] = []
  for (let k = 0; k < seq.length; k++) {
    const from = k === 0 ? 0 : seq[k - 1] + 1
    const to = seq[k] + 1
    t += matrix.time[from][to]
    d += matrix.dist[from][to]
    const stop = stops[seq[k]]
    if (!vehicle.acceptedCategories.includes(stop.category)) {
      return { ok: false, time: t, dist: d, late, etas, reason: `Vehicle cannot accept ${stop.category}` }
    }
    load += stop.demand
    if (load > vehicle.capacity) return { ok: false, time: t, dist: d, late, etas, reason: 'Capacity exceeded' }
    t += stop.serviceMin
    etas.push(t)
    if (t > stop.deadlineMin) late += (t - stop.deadlineMin) * stop.priorityWeight
    if (t > vehicle.shiftMin) return { ok: false, time: t, dist: d, late, etas, reason: 'Shift duration exceeded' }
  }
  if (seq.length) {
    const last = seq[seq.length - 1] + 1
    t += matrix.time[last][0]
    d += matrix.dist[last][0]
    if (t > vehicle.shiftMin) return { ok: false, time: t, dist: d, late, etas, reason: 'Cannot return to depot in shift' }
  }
  return { ok: true, time: t, dist: d, late, etas }
}

function cheapestInsertion(
  vehicles: SolverVehicle[],
  stops: SolverStop[],
  matrix: Matrix,
): { routes: number[][]; unassigned: { id: string; reason: string }[] } {
  const routes = vehicles.map(() => [] as number[])
  const remaining = stops.map((_, i) => i)
  remaining.sort((a, b) => stops[b].priorityWeight - stops[a].priorityWeight)
  const unassigned: { id: string; reason: string }[] = []

  for (const idx of remaining) {
    let best: { v: number; pos: number; score: number } | null = null
    let lastReason = 'No feasible insertion'
    for (let v = 0; v < vehicles.length; v++) {
      const seq = routes[v]
      for (let pos = 0; pos <= seq.length; pos++) {
        const cand = [...seq.slice(0, pos), idx, ...seq.slice(pos)]
        const r = routeCost(cand, vehicles[v], stops, matrix)
        if (!r.ok) {
          lastReason = r.reason ?? lastReason
          continue
        }
        const score = r.time + r.late
        if (!best || score < best.score) best = { v, pos, score }
      }
    }
    if (!best) unassigned.push({ id: stops[idx].id, reason: lastReason })
    else routes[best.v].splice(best.pos, 0, idx)
  }
  return { routes, unassigned }
}

function twoOpt(seq: number[], vehicle: SolverVehicle, stops: SolverStop[], matrix: Matrix) {
  let improved = true
  let current = [...seq]
  while (improved) {
    improved = false
    for (let i = 0; i < current.length - 1; i++) {
      for (let j = i + 1; j < current.length; j++) {
        const next = [...current]
        const slice = next.slice(i, j + 1).reverse()
        next.splice(i, j + 1 - i, ...slice)
        const a = routeCost(current, vehicle, stops, matrix)
        const b = routeCost(next, vehicle, stops, matrix)
        if (b.ok && a.ok && b.time + b.late < a.time + a.late - 1e-6) {
          current = next
          improved = true
        }
      }
    }
  }
  return current
}

function relocate(routes: number[][], vehicles: SolverVehicle[], stops: SolverStop[], matrix: Matrix) {
  for (let v = 0; v < routes.length; v++) {
    for (let i = 0; i < routes[v].length; i++) {
      const node = routes[v][i]
      for (let w = 0; w < routes.length; w++) {
        if (w === v) continue
        for (let p = 0; p <= routes[w].length; p++) {
          const from = [...routes[v]]
          from.splice(i, 1)
          const to = [...routes[w]]
          to.splice(p, 0, node)
          const a0 = routeCost(routes[v], vehicles[v], stops, matrix)
          const a1 = routeCost(routes[w], vehicles[w], stops, matrix)
          const b0 = routeCost(from, vehicles[v], stops, matrix)
          const b1 = routeCost(to, vehicles[w], stops, matrix)
          if (a0.ok && a1.ok && b0.ok && b1.ok && b0.time + b1.time + b0.late + b1.late < a0.time + a1.time + a0.late + a1.late - 1e-6) {
            routes[v] = from
            routes[w] = to
            return true
          }
        }
      }
    }
  }
  return false
}

export function nearestNeighbourOrder(stops: SolverStop[], matrix: Matrix) {
  const left = new Set(stops.map((_, i) => i))
  const order: number[] = []
  let cur = 0
  while (left.size) {
    let best = -1
    let bestT = Infinity
    for (const i of left) {
      const t = matrix.time[cur][i + 1]
      if (t < bestT) {
        bestT = t
        best = i
      }
    }
    order.push(best)
    left.delete(best)
    cur = best + 1
  }
  return order
}

export function originalOrder(stops: SolverStop[]) {
  return stops.map((_, i) => i)
}

function metricsFrom(
  routes: BuiltRoute[],
  unassigned: number,
  runtimeMs: number,
  approximate: boolean,
  fallback = false,
): RouteMetrics {
  return {
    distanceKm: round(routes.reduce((s, r) => s + r.distanceKm, 0)),
    timeMin: round(routes.reduce((s, r) => s + r.timeMin, 0)),
    stopsServed: routes.reduce((s, r) => s + r.stopIds.length, 0),
    constraintViolations: 0,
    runtimeMs,
    unassigned,
    approximate,
    fallback,
  }
}

function materialise(
  seqs: number[][],
  vehicles: SolverVehicle[],
  stops: SolverStop[],
  matrix: Matrix,
): BuiltRoute[] {
  return seqs.map((seq, i) => {
    const c = routeCost(seq, vehicles[i], stops, matrix)
    return {
      vehicleId: vehicles[i].id,
      stopIds: seq.map((s) => stops[s].id),
      timeMin: round(c.time),
      distanceKm: round(c.dist),
      etas: c.etas.map(round),
    }
  })
}

export function validateSolution(
  routes: BuiltRoute[],
  stops: SolverStop[],
  vehicles: SolverVehicle[],
  matrix: Matrix,
) {
  const seen = new Set<string>()
  const violations: string[] = []
  for (const r of routes) {
    const v = vehicles.find((x) => x.id === r.vehicleId)
    if (!v) {
      violations.push(`Unknown vehicle ${r.vehicleId}`)
      continue
    }
    const seq = r.stopIds.map((id) => stops.findIndex((s) => s.id === id)).filter((i) => i >= 0)
    for (const id of r.stopIds) {
      if (seen.has(id)) violations.push(`Stop ${id} assigned twice`)
      seen.add(id)
    }
    const c = routeCost(seq, v, stops, matrix)
    if (!c.ok) violations.push(c.reason ?? 'invalid route')
  }
  return { ok: violations.length === 0, violations }
}

export function solveVrp(input: {
  depot: { lat: number; lng: number }
  stops: SolverStop[]
  vehicles: SolverVehicle[]
  matrix?: Matrix
  timeLimitMs?: number
  seed?: number
  fallback?: boolean
}): { optimised: SolverOutput; nearestNeighbour: SolverOutput; original: SolverOutput } {
  const t0 = Date.now()
  const limit = input.timeLimitMs ?? 3000
  const points = [input.depot, ...input.stops]
  const matrix = input.matrix ?? haversineMatrix(points)
  const rng = mulberry32(input.seed ?? 42)

  if (input.fallback) {
    const order = [...input.stops.keys()].sort((a, b) => {
      const pw = input.stops[b].priorityWeight - input.stops[a].priorityWeight
      if (pw) return pw
      return matrix.dist[0][a + 1] - matrix.dist[0][b + 1]
    })
    const seqs = input.vehicles.map(() => [] as number[])
    const unassigned: { id: string; reason: string }[] = []
    for (const idx of order) {
      let placed = false
      for (let v = 0; v < seqs.length; v++) {
        const cand = [...seqs[v], idx]
        if (routeCost(cand, input.vehicles[v], input.stops, matrix).ok) {
          seqs[v] = cand
          placed = true
          break
        }
      }
      if (!placed) unassigned.push({ id: input.stops[idx].id, reason: 'Fallback could not place stop' })
    }
    const routes = materialise(seqs, input.vehicles, input.stops, matrix)
    const out: SolverOutput = {
      routes,
      unassigned,
      metrics: metricsFrom(routes, unassigned.length, Date.now() - t0, matrix.approximate, true),
      objective: objective(routes, unassigned.length, 0),
    }
    return { optimised: out, nearestNeighbour: out, original: out }
  }

  const construction = cheapestInsertion(input.vehicles, input.stops, matrix)
  let seqs = construction.routes
  const unassigned = construction.unassigned
  seqs = seqs.map((seq, i) => twoOpt(seq, input.vehicles[i], input.stops, matrix))
  while (Date.now() - t0 < limit * 0.7) {
    const moved = relocate(seqs, input.vehicles, input.stops, matrix)
    if (!moved) break
    void rng()
  }
  seqs = seqs.map((seq, i) => twoOpt(seq, input.vehicles[i], input.stops, matrix))

  const routes = materialise(seqs, input.vehicles, input.stops, matrix)
  const late = seqs.reduce((s, seq, i) => s + routeCost(seq, input.vehicles[i], input.stops, matrix).late, 0)
  const optimised: SolverOutput = {
    routes,
    unassigned,
    metrics: metricsFrom(routes, unassigned.length, Date.now() - t0, matrix.approximate),
    objective: objective(routes, unassigned.length, late),
  }

  const nnOrder = nearestNeighbourOrder(input.stops, matrix)
  const nnSeqs = splitRoundRobin(nnOrder, input.vehicles, input.stops, matrix)
  const nnRoutes = materialise(nnSeqs.seqs, input.vehicles, input.stops, matrix)
  const nearestNeighbour: SolverOutput = {
    routes: nnRoutes,
    unassigned: nnSeqs.unassigned,
    metrics: metricsFrom(nnRoutes, nnSeqs.unassigned.length, Date.now() - t0, matrix.approximate),
    objective: objective(nnRoutes, nnSeqs.unassigned.length, 0),
  }

  const origSeqs = splitRoundRobin(originalOrder(input.stops), input.vehicles, input.stops, matrix)
  const origRoutes = materialise(origSeqs.seqs, input.vehicles, input.stops, matrix)
  const original: SolverOutput = {
    routes: origRoutes,
    unassigned: origSeqs.unassigned,
    metrics: metricsFrom(origRoutes, origSeqs.unassigned.length, Date.now() - t0, matrix.approximate),
    objective: objective(origRoutes, origSeqs.unassigned.length, 0),
  }

  return { optimised, nearestNeighbour, original }
}

function splitRoundRobin(
  order: number[],
  vehicles: SolverVehicle[],
  stops: SolverStop[],
  matrix: Matrix,
) {
  const seqs = vehicles.map(() => [] as number[])
  const unassigned: { id: string; reason: string }[] = []
  for (const idx of order) {
    let placed = false
    const ranked = vehicles
      .map((v, i) => ({ i, len: seqs[i].length }))
      .sort((a, b) => a.len - b.len)
    for (const { i } of ranked) {
      const cand = [...seqs[i], idx]
      if (routeCost(cand, vehicles[i], stops, matrix).ok) {
        seqs[i] = cand
        placed = true
        break
      }
    }
    if (!placed) unassigned.push({ id: stops[idx].id, reason: 'Infeasible in baseline split' })
  }
  return { seqs, unassigned }
}

function round(n: number) {
  return Math.round(n * 10) / 10
}

export const SOLVER_VERSION = 'ecobrain-vrp-1.2.0'
