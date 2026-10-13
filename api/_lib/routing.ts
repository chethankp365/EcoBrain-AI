import { env } from './env'
import { haversineMatrix, type Matrix } from '../../shared/solver'

export async function travelMatrix(points: { lat: number; lng: number }[]): Promise<Matrix> {
  const e = env()
  if (e.routingProvider === 'osrm') {
    try {
      const coords = points.map((p) => `${p.lng},${p.lat}`).join(';')
      const url = `${e.osrm}/table/v1/driving/${coords}?annotations=duration,distance`
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 4000)
      const res = await fetch(url, { signal: ctrl.signal })
      clearTimeout(t)
      if (!res.ok) throw new Error('osrm')
      const json = await res.json()
      const time = json.durations.map((row: number[]) => row.map((s) => (s ?? 1e6) / 60))
      const dist = json.distances.map((row: number[]) => row.map((m) => (m ?? 1e6) / 1000))
      return { time, dist, approximate: false }
    } catch {
      return haversineMatrix(points)
    }
  }
  return haversineMatrix(points)
}
