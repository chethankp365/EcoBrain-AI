import type { Category, DuplicateSuggestion, ReportStatus } from './types'
import { haversineM } from './priority'

const RELATED: Record<Category, Category[]> = {
  overflowing_bin: ['overflowing_bin', 'missed_collection'],
  missed_collection: ['missed_collection', 'overflowing_bin'],
  litter_hotspot: ['litter_hotspot', 'illegal_dumping'],
  illegal_dumping: ['illegal_dumping', 'litter_hotspot'],
  recyclable_material: ['recyclable_material', 'other'],
  other: ['other'],
}

export function findDuplicates(input: {
  category: Category
  lat: number
  lng: number
  now?: Date
  radiusM?: number
  windowHours?: number
  candidates: {
    id: string
    code: string
    category: Category
    lat: number
    lng: number
    createdAt: string
    status: ReportStatus
    duplicateOf?: string
  }[]
}): DuplicateSuggestion[] {
  const now = input.now ?? new Date()
  const radius = input.radiusM ?? 50
  const windowH = input.windowHours ?? 72
  const related = RELATED[input.category]

  return input.candidates
    .filter((c) => !c.duplicateOf && related.includes(c.category))
    .map((c) => {
      const distanceM = haversineM({ lat: input.lat, lng: input.lng }, c)
      const ageHours = (now.getTime() - new Date(c.createdAt).getTime()) / 36e5
      return {
        reportId: c.id,
        reportCode: c.code,
        distanceM,
        ageHours,
        category: c.category,
        status: c.status,
      }
    })
    .filter((d) => d.distanceM <= radius && d.ageHours <= windowH && d.ageHours >= 0)
    .sort((a, b) => a.distanceM - b.distanceM || a.ageHours - b.ageHours)
}
