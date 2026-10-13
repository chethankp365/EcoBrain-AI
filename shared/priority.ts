import type { Category, PriorityResult, SensitiveLocation, SystemSettings } from './types'

const CATEGORY_BASE: Record<Category, number> = {
  overflowing_bin: 28,
  illegal_dumping: 32,
  missed_collection: 22,
  litter_hotspot: 16,
  recyclable_material: 10,
  other: 8,
}

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function scorePriority(input: {
  category: Category
  createdAt: string
  now?: Date
  lat: number
  lng: number
  sensitive: SensitiveLocation[]
  repeatCount72h: number
  fillLevel?: number
  settings: SystemSettings
}): PriorityResult {
  const w = input.settings.priorityWeights
  const now = input.now ?? new Date()
  const hours = Math.max(0, (now.getTime() - new Date(input.createdAt).getTime()) / 36e5)

  const catPts = CATEGORY_BASE[input.category] * (w.category / 10)
  const agePts = Math.min(30, hours * 0.6) * (w.age / 10)
  const nearest = input.sensitive
    .map((s) => ({ s, d: haversineM({ lat: input.lat, lng: input.lng }, s) }))
    .sort((a, b) => a.d - b.d)[0]
  const sensPts =
    nearest && nearest.d < 250 ? (25 * (1 - nearest.d / 250) * w.sensitive) / 10 : 0
  const repeatPts = Math.min(20, input.repeatCount72h * 6) * (w.repeat / 10)
  const fillPts = input.fillLevel != null ? (input.fillLevel / 100) * 18 * (w.fill / 10) : 0

  const factors = [
    { name: 'Category severity', points: round(catPts), explanation: `${input.category.replaceAll('_', ' ')} base severity` },
    { name: 'Hours waiting', points: round(agePts), explanation: `${hours.toFixed(1)}h in queue` },
    {
      name: 'Sensitive location',
      points: round(sensPts),
      explanation: nearest ? `${nearest.s.kind} ${Math.round(nearest.d)}m away` : 'None nearby',
    },
    { name: 'Repeat frequency', points: round(repeatPts), explanation: `${input.repeatCount72h} similar reports in 72h` },
    {
      name: 'Bin fill level',
      points: round(fillPts),
      explanation: input.fillLevel != null ? `${input.fillLevel}% fill` : 'No sensor',
    },
  ]

  const score = Math.min(100, factors.reduce((n, f) => n + f.points, 0))
  const label = score >= 75 ? 'urgent' : score >= 55 ? 'high' : score >= 35 ? 'medium' : 'low'
  return { score: round(score), label, factors }
}

function round(n: number) {
  return Math.round(n * 10) / 10
}

export { haversineM }
