import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { findDuplicates } from '../../shared/duplicates'
import { scorePriority } from '../../shared/priority'
import type { ClassificationResult, Profile, WasteReport } from '../../shared/types'
import { classifyReport } from './classify'
import { apiError } from './errors'
import { env } from './env'
import { supabaseAdmin } from './supabase'

const priorityFactorSchema = z.object({
  name: z.string(),
  points: z.number(),
  explanation: z.string(),
})

const reportRowSchema = z.object({
  id: z.string().uuid(),
  report_code: z.string().nullable(),
  reporter_id: z.string().uuid().nullable(),
  category: z.enum(['overflowing_bin', 'missed_collection', 'litter_hotspot', 'illegal_dumping', 'recyclable_material', 'other']),
  description: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  address: z.string().nullable(),
  photo_path: z.string().nullable(),
  priority_score: z.number(),
  priority_label: z.enum(['low', 'medium', 'high', 'urgent']),
  priority_factors: z.array(priorityFactorSchema),
  status: z.enum(['submitted', 'validated', 'pending_assignment', 'assigned', 'in_progress', 'completed', 'needs_review', 'partially_completed', 'inaccessible', 'rejected_duplicate', 'reopened']),
  source: z.enum(['resident', 'worker', 'sensor_simulated']),
  duplicate_of: z.string().uuid().nullable(),
  is_simulated: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().nullable(),
})

const reportSelect = 'id,report_code,reporter_id,category,description,latitude,longitude,address,photo_path,priority_score,priority_label,priority_factors,status,source,duplicate_of,is_simulated,created_at,updated_at,completed_at'

function mapReport(value: unknown): WasteReport {
  const row = reportRowSchema.safeParse(value)
  if (!row.success) throw apiError(503, 'invalid_report', 'Supabase returned an invalid report')
  const r = row.data
  if (!r.report_code) throw apiError(503, 'invalid_report', 'Supabase did not assign a report code')
  return {
    id: r.id,
    code: r.report_code,
    reporterId: r.reporter_id,
    category: r.category,
    description: r.description,
    lat: r.latitude,
    lng: r.longitude,
    address: r.address ?? '',
    photoPath: r.photo_path ?? undefined,
    priorityScore: r.priority_score,
    priorityLabel: r.priority_label,
    priorityFactors: r.priority_factors,
    status: r.status,
    source: r.source,
    duplicateOf: r.duplicate_of ?? undefined,
    isSimulated: r.is_simulated,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at ?? undefined,
  }
}

const classificationRowSchema = z.object({
  id: z.string().uuid(),
  report_id: z.string().uuid(),
  predicted_category: z.enum(['overflowing_bin', 'missed_collection', 'litter_hotspot', 'illegal_dumping', 'recyclable_material', 'other']),
  confidence: z.number(),
  visible_evidence: z.string(),
  warnings: z.array(z.string()),
  model_version: z.string(),
  latency_ms: z.number().nullable(),
  fallback: z.boolean(),
  reviewed_category: z.enum(['overflowing_bin', 'missed_collection', 'litter_hotspot', 'illegal_dumping', 'recyclable_material', 'other']).nullable(),
  reviewed_by: z.string().uuid().nullable(),
  created_at: z.string(),
})

function mapClassification(value: unknown): ClassificationResult {
  const row = classificationRowSchema.safeParse(value)
  if (!row.success) throw apiError(503, 'invalid_classification', 'Supabase returned an invalid classification')
  return {
    id: row.data.id,
    reportId: row.data.report_id,
    label: row.data.predicted_category,
    confidence: row.data.confidence,
    modelVersion: row.data.model_version,
    visibleEvidence: row.data.visible_evidence,
    warnings: row.data.warnings,
    latencyMs: row.data.latency_ms ?? 0,
    reviewedCategory: row.data.reviewed_category ?? undefined,
    reviewedBy: row.data.reviewed_by ?? undefined,
    fallback: row.data.fallback,
    createdAt: row.data.created_at,
  }
}

function mapTimeline(value: unknown) {
  const row = z.object({
    id: z.string().uuid(),
    report_id: z.string().uuid(),
    from_status: z.string().nullable(),
    to_status: z.string(),
    actor_id: z.string().uuid().nullable(),
    actor_role: z.string().nullable(),
    note: z.string().nullable(),
    created_at: z.string(),
  }).parse(value)
  return {
    id: row.id,
    reportId: row.report_id,
    fromStatus: row.from_status ?? undefined,
    toStatus: row.to_status,
    actorId: row.actor_id ?? '',
    actorRole: row.actor_role ?? 'resident',
    note: row.note ?? undefined,
    createdAt: row.created_at,
  }
}

function databaseFailure(code: string, message: string): never {
  throw apiError(503, code, message)
}

export async function listLiveReports(input: {
  profile: Profile
  page: number
  limit: number
  status?: string
  category?: string
  q?: string
}) {
  const db = supabaseAdmin()
  let query = db.from('waste_reports').select(reportSelect, { count: 'exact' }).order('created_at', { ascending: false })

  if (input.profile.role === 'resident') {
    query = query.eq('reporter_id', input.profile.id)
  } else if (input.profile.role === 'worker') {
    const { data: assignments, error: assignmentError } = await db
      .from('assignments')
      .select('report_id')
      .eq('worker_id', input.profile.id)
    if (assignmentError) databaseFailure('reports_unavailable', 'Could not load assigned reports')
    const assignedIds = (assignments ?? []).map((assignment) => assignment.report_id as string)
    if (assignedIds.length) {
      query = query.or(`reporter_id.eq.${input.profile.id},id.in.(${assignedIds.join(',')})`)
    } else {
      query = query.eq('reporter_id', input.profile.id)
    }
  }

  if (input.status) query = query.eq('status', input.status)
  if (input.category) query = query.eq('category', input.category)
  if (input.q) {
    const term = input.q.trim()
    if (!/^[\p{L}\p{N} _-]{1,80}$/u.test(term)) throw apiError(422, 'invalid_search', 'Search may only contain letters, numbers, spaces, hyphens, and underscores')
    query = query.or(`report_code.ilike.%${term}%,description.ilike.%${term}%`)
  }

  const start = (input.page - 1) * input.limit
  const { data, error, count } = await query.range(start, start + input.limit - 1)
  if (error) databaseFailure('reports_unavailable', 'Could not load reports from Supabase')
  const reports = (data ?? []).map(mapReport)
  if (input.profile.role === 'analyst') {
    for (const report of reports) {
      report.lat = Math.round(report.lat * 1000) / 1000
      report.lng = Math.round(report.lng * 1000) / 1000
    }
  }
  return { data: reports, page: input.page, limit: input.limit, total: count ?? 0 }
}

export async function createLiveReport(input: {
  profile: Profile
  category: WasteReport['category']
  description: string
  lat: number
  lng: number
  address?: string
  photo?: string
  submitAnyway?: boolean
  linkTo?: string
}) {
  const { profile } = input
  if (profile.role !== 'resident' && profile.role !== 'worker') {
    throw apiError(403, 'forbidden', 'Only residents and workers can create reports')
  }

  const db = supabaseAdmin()
  const { data: areas, error: areaError } = await db.rpc('service_area_for_point', {
    point_latitude: input.lat,
    point_longitude: input.lng,
  })
  if (areaError) databaseFailure('service_area_unavailable', 'Could not validate the report location')
  const area = areas?.[0]
  if (!area) throw apiError(422, 'out_of_area', 'This location is outside the configured service area')
  if (input.linkTo) {
    const { data: duplicate, error: duplicateError } = await db
      .from('waste_reports')
      .select('id,service_area_id')
      .eq('id', input.linkTo)
      .maybeSingle()
    if (duplicateError) databaseFailure('duplicate_unavailable', 'Could not validate the linked report')
    if (!duplicate || duplicate.service_area_id !== area.id) throw apiError(422, 'invalid_duplicate', 'Choose a report in the same service area')
  }

  const { data: settingsRow, error: settingsError } = await db
    .from('system_settings')
    .select('ai_confidence_threshold,priority_weights,fuel_per_km_l,emission_kg_per_l,retention_days,duplicate_radius_m,duplicate_window_hours')
    .eq('id', true)
    .single()
  if (settingsError || !settingsRow) databaseFailure('settings_unavailable', 'Could not load report settings')
  const settings = z.object({
    ai_confidence_threshold: z.number(),
    priority_weights: z.object({
      category: z.number(),
      age: z.number(),
      sensitive: z.number(),
      repeat: z.number(),
      fill: z.number(),
    }),
    duplicate_radius_m: z.number(),
    duplicate_window_hours: z.number(),
  }).parse(settingsRow)

  const cutoff = new Date(Date.now() - settings.duplicate_window_hours * 60 * 60 * 1000).toISOString()
  const { data: candidates, error: candidateError } = await db
    .from('waste_reports')
    .select(reportSelect)
    .eq('service_area_id', area.id)
    .eq('category', input.category)
    .gte('created_at', cutoff)
    .not('status', 'in', '("completed","rejected_duplicate")')
    .limit(500)
  if (candidateError) databaseFailure('duplicates_unavailable', 'Could not check nearby reports')
  const duplicates = findDuplicates({
    category: input.category,
    lat: input.lat,
    lng: input.lng,
    radiusM: settings.duplicate_radius_m,
    windowHours: settings.duplicate_window_hours,
    candidates: (candidates ?? []).map(mapReport),
  })
  if (duplicates.length && !input.submitAnyway && !input.linkTo) {
    return { possibleDuplicates: duplicates }
  }

  const priority = scorePriority({
    category: input.category,
    createdAt: new Date().toISOString(),
    lat: input.lat,
    lng: input.lng,
    sensitive: [],
    repeatCount72h: duplicates.length,
    settings: {
      aiThreshold: settings.ai_confidence_threshold,
      priorityWeights: settings.priority_weights,
      fuelPerKmL: 0,
      emissionKgPerL: 0,
      retentionDays: 1,
      duplicateRadiusM: settings.duplicate_radius_m,
      duplicateWindowHours: settings.duplicate_window_hours,
    },
  })

  let photoPath: string | undefined
  if (input.photo) {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/.exec(input.photo)
    if (!match) throw apiError(422, 'invalid_photo', 'Photo must be a JPEG, PNG, or WebP image')
    const extension = match[1] === 'image/jpeg' ? 'jpg' : match[1].slice('image/'.length)
    photoPath = `${profile.id}/${randomUUID()}.${extension}`
    const { error: uploadError } = await db.storage.from('report-photos').upload(photoPath, Buffer.from(match[2], 'base64'), {
      contentType: match[1],
      upsert: false,
    })
    if (uploadError) databaseFailure('photo_upload_failed', 'Could not store the report photo')
  }

  const { data: inserted, error: insertError } = await db
    .from('waste_reports')
    .insert({
      reporter_id: profile.id,
      service_area_id: area.id,
      category: input.category,
      description: input.description,
      location: `SRID=4326;POINT(${input.lng} ${input.lat})`,
      address: input.address || `${input.lat.toFixed(5)}, ${input.lng.toFixed(5)}`,
      photo_path: photoPath,
      priority_score: priority.score,
      priority_label: priority.label,
      priority_factors: priority.factors,
      status: 'submitted',
      source: profile.role,
      is_simulated: false,
      duplicate_of: input.linkTo ?? null,
    })
    .select(reportSelect)
    .single()

  if (insertError) {
    if (photoPath) {
      const { error: cleanupError } = await db.storage.from('report-photos').remove([photoPath])
      if (cleanupError) databaseFailure('report_cleanup_failed', 'Report creation failed and the uploaded photo could not be removed')
    }
    databaseFailure('report_create_failed', 'Could not save the report to Supabase')
  }

  return { report: mapReport(inserted), duplicates }
}

export async function getLiveReport(id: string, profile: Profile) {
  const db = supabaseAdmin()
  const { data, error } = await db.from('waste_reports').select(reportSelect).eq('id', id).maybeSingle()
  if (error) databaseFailure('report_unavailable', 'Could not load the report from Supabase')
  if (!data) throw apiError(404, 'not_found', 'Report not found')
  const report = mapReport(data)
  if (profile.role === 'analyst') {
    report.lat = Math.round(report.lat * 1000) / 1000
    report.lng = Math.round(report.lng * 1000) / 1000
  }

  if (profile.role === 'resident' && report.reporterId !== profile.id) throw apiError(403, 'forbidden', 'You do not have access to this report')
  if (profile.role === 'worker' && report.reporterId !== profile.id) {
    const { data: assignment, error: assignmentError } = await db
      .from('assignments')
      .select('id')
      .eq('report_id', report.id)
      .eq('worker_id', profile.id)
      .maybeSingle()
    if (assignmentError) databaseFailure('report_access_unavailable', 'Could not verify report access')
    if (!assignment) throw apiError(403, 'forbidden', 'You do not have access to this report')
  }

  const [{ data: classification, error: classificationError }, { data: timeline, error: timelineError }] = await Promise.all([
    db.from('classification_results').select('*').eq('report_id', report.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('status_events').select('*').eq('report_id', report.id).order('created_at', { ascending: true }),
  ])
  if (classificationError || timelineError) databaseFailure('report_history_unavailable', 'Could not load report history')

  let photoUrl: string | undefined
  if (report.photoPath) {
    const { data: signed, error: signedError } = await db.storage.from('report-photos').createSignedUrl(report.photoPath, 60)
    if (signedError) databaseFailure('photo_url_unavailable', 'Could not create a secure photo link')
    photoUrl = signed.signedUrl
  }

  return {
    report,
    classification: classification ? mapClassification(classification) : null,
    timeline: (timeline ?? []).map(mapTimeline),
    photoUrl,
  }
}

export async function classifyLiveReport(id: string, profile: Profile) {
  const db = supabaseAdmin()
  const { report } = await getLiveReport(id, profile)
  let imageBase64: string | undefined
  if (report.photoPath) {
    const { data, error } = await db.storage.from('report-photos').download(report.photoPath)
    if (error) databaseFailure('photo_unavailable', 'Could not load the stored report photo')
    imageBase64 = Buffer.from(await data.arrayBuffer()).toString('base64')
  }

  const result = await classifyReport({ description: report.description, imageBase64 })
  const { data: classification, error: classificationError } = await db
    .from('classification_results')
    .insert({
      report_id: report.id,
      predicted_category: result.label,
      waste_type: result.waste_type,
      confidence: result.confidence,
      visible_evidence: result.visible_evidence,
      warnings: result.warnings,
      model_version: result.modelVersion,
      latency_ms: result.latencyMs,
      fallback: result.fallback,
    })
    .select('*')
    .single()
  if (classificationError) databaseFailure('classification_save_failed', 'Could not save the AI result')

  const nextStatus = result.confidence < env().aiThreshold ? 'needs_review' : report.status === 'submitted' ? 'validated' : report.status
  if (nextStatus !== report.status) {
    const { error: updateError } = await db.rpc('set_report_status', {
      target_report_id: report.id,
      next_status: nextStatus,
      actor_profile_id: profile.id,
      actor_user_role: profile.role,
      event_note: result.confidence < env().aiThreshold ? 'Low-confidence AI — needs review' : 'Validated after AI classification',
    })
    if (updateError) databaseFailure('report_status_update_failed', 'Could not update the report status and history')
  }

  return mapClassification(classification)
}
