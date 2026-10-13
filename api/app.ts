import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { cors } from 'hono/cors'
import { z } from 'zod'
import { CATEGORIES, type Category, type Profile, type ReportStatus, type UserRole } from '../shared/types'
import { assertTransition, canApproveRoutes, canMergeDuplicates, IllegalTransitionError } from '../shared/transitions'
import { haversineM, scorePriority } from '../shared/priority'
import { findDuplicates } from '../shared/duplicates'
import { estimatedFuelAndCo2e, mean, percentile, seasonalNaiveForecast } from '../shared/metrics'
import { SOLVER_VERSION, solveVrp, validateSolution, type SolverStop } from '../shared/solver'
import { authMiddleware, demoLogin, requireRole } from './_lib/auth'
import { classifyReport } from './_lib/classify'
import { env, usingSupabase } from './_lib/env'
import { apiError, errorBody } from './_lib/errors'
import { pointInPolygon } from './_lib/geo'
import { classifyLiveReport, createLiveReport, getLiveReport, listLiveReports } from './_lib/liveReports'
import { travelMatrix } from './_lib/routing'
import { store } from './_lib/store'
import { profileFromRow, supabaseAdmin, supabaseAuth, supabaseProfileForToken } from './_lib/supabase'

type Vars = { profile: Profile }

export const app = new Hono<{ Variables: Vars }>().basePath('/api')

const buckets = new Map<string, { n: number; t: number }>()
function rateLimit(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now()
  const slot = buckets.get(key)
  if (!slot || now - slot.t > windowMs) {
    buckets.set(key, { n: 1, t: now })
    return
  }
  slot.n += 1
  if (slot.n > limit) throw apiError(429, 'rate_limited', 'Too many requests')
}

app.use('*', cors({ origin: env().origin, credentials: true }))
app.onError((err, c) => {
  const status = err instanceof HTTPException ? err.status : 500
  return c.json(errorBody(err), status as never)
})
app.use('*', authMiddleware)
app.use('*', async (c, next) => {
  if (env().demoMode || c.req.method === 'OPTIONS') return next()
  const path = new URL(c.req.url).pathname
  const method = c.req.method
  const supported =
    (method === 'GET' && path === '/api/health') ||
    (method === 'POST' && ['/api/auth/login', '/api/auth/signup', '/api/auth/forgot', '/api/auth/refresh', '/api/auth/password', '/api/auth/logout'].includes(path)) ||
    ((method === 'GET' || method === 'PATCH') && path === '/api/me') ||
    ((method === 'GET' || method === 'POST') && path === '/api/reports') ||
    (method === 'GET' && /^\/api\/reports\/[0-9a-f-]{36}$/i.test(path)) ||
    (method === 'POST' && /^\/api\/reports\/[0-9a-f-]{36}\/classify$/i.test(path))
  if (!supported) {
    throw apiError(503, 'feature_not_configured', 'This operational feature is not connected to live data yet')
  }
  return next()
})

app.get('/health', async (c) => {
  const config = env()
  let supabaseReady = false
  let serviceAreas: string[] = []
  if (!config.demoMode && usingSupabase()) {
    const { data, error } = await supabaseAdmin()
      .from('service_areas')
      .select('name')
      .eq('is_active', true)
      .order('created_at')
      .limit(20)
    supabaseReady = !error
    serviceAreas = (data ?? []).map((area) => area.name)
  }
  return c.json({
    ok: true,
    demoMode: config.demoMode,
    databaseMode: config.demoMode ? 'memory' : 'supabase',
    supabaseReady,
    serviceAreas,
    geminiConfigured: Boolean(config.geminiKey),
    liveFeatures: config.demoMode ? [] : ['auth', 'reports', 'ai_classification'],
    solver: SOLVER_VERSION,
  })
})

app.post('/auth/login', async (c) => {
  rateLimit(c.req.header('x-forwarded-for') || 'login', 20)
  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(await c.req.json())
  if (!env().demoMode) {
    const { data, error } = await supabaseAuth().auth.signInWithPassword(body)
    if (error || !data.session) throw apiError(401, 'invalid_credentials', 'Email or password is incorrect')
    const profile = await supabaseProfileForToken(data.session.access_token)
    return c.json({ token: data.session.access_token, refreshToken: data.session.refresh_token, profile })
  }
  return c.json(demoLogin(body.email, body.password))
})

app.post('/auth/refresh', async (c) => {
  if (env().demoMode) throw apiError(404, 'not_found', 'Session refresh is unavailable in demo mode')
  rateLimit(c.req.header('x-forwarded-for') || 'refresh', 30)
  const body = z.object({ refreshToken: z.string().min(1) }).parse(await c.req.json())
  const { data, error } = await supabaseAuth().auth.refreshSession({ refresh_token: body.refreshToken })
  if (error || !data.session) throw apiError(401, 'session_expired', 'Session expired; please sign in again')
  const profile = await supabaseProfileForToken(data.session.access_token)
  return c.json({ token: data.session.access_token, refreshToken: data.session.refresh_token, profile })
})

app.post('/auth/signup', async (c) => {
  const body = z
    .object({ email: z.string().trim().email().max(254), password: z.string().min(10).max(128), displayName: z.string().trim().min(2).max(80) })
    .parse(await c.req.json())
  if (!env().demoMode) {
    const { data, error } = await supabaseAuth().auth.signUp({
      email: body.email,
      password: body.password,
      options: { data: { display_name: body.displayName } },
    })
    if (error) throw apiError(error.status === 400 ? 409 : 502, 'signup_failed', 'Could not create your Supabase account')
    if (!data.session) {
      return c.json({ requiresEmailConfirmation: true }, 202)
    }
    const profile = await supabaseProfileForToken(data.session.access_token)
    return c.json({ token: data.session.access_token, refreshToken: data.session.refresh_token, profile }, 201)
  }
  const email = body.email.toLowerCase()
  if (store.profiles.some((p) => p.email.toLowerCase() === email)) throw apiError(409, 'exists', 'Email already registered')
  const profile: Profile = {
    id: store.uid('user'),
    email,
    role: 'resident',
    status: 'active',
    displayName: body.displayName,
    language: 'en',
    notificationPrefs: { inApp: true, email: false },
    createdAt: store.stamp(),
  }
  store.profiles.push(profile)
  store.passwords.set(profile.email.toLowerCase(), body.password)
  writeAudit('system', 'signup', 'profile', profile.id, { email: body.email })
  return c.json(demoLogin(body.email, body.password))
})

app.post('/auth/forgot', async (c) => {
  const body = z.object({ email: z.string().email() }).parse(await c.req.json())
  if (!env().demoMode) {
    const { error } = await supabaseAuth().auth.resetPasswordForEmail(body.email, {
      redirectTo: `${env().origin}/reset-password`,
    })
    if (error) throw apiError(502, 'reset_email_failed', 'Could not request a password reset')
    return c.json({ ok: true, message: 'If the account exists, a password reset link has been sent.' })
  }
  return c.json({ ok: true, message: 'If the account exists, a reset link would be emailed.' })
})

app.post('/auth/password', async (c) => {
  if (env().demoMode) throw apiError(404, 'not_found', 'Password reset is unavailable in demo mode')
  const body = z.object({ password: z.string().min(10).max(128) }).parse(await c.req.json())
  const { error } = await supabaseAdmin().auth.admin.updateUserById(c.get('profile').id, { password: body.password })
  if (error) throw apiError(502, 'password_update_failed', 'Could not update the password')
  return c.json({ ok: true })
})

app.post('/auth/logout', async (c) => {
  const token = (c.req.header('authorization') || '').replace(/^Bearer\s+/i, '')
  if (env().demoMode) {
    store.sessions = store.sessions.filter((session) => session.token !== token)
    return c.json({ ok: true })
  }
  const { error } = await supabaseAdmin().auth.admin.signOut(token, 'local')
  if (error) throw apiError(502, 'logout_failed', 'Could not revoke the Supabase session')
  return c.json({ ok: true })
})

app.get('/me', (c) => c.json(c.get('profile')))

app.patch('/me', async (c) => {
  const body = z
    .object({
      language: z.enum(['en', 'hi', 'kn']).optional(),
      notificationPrefs: z.object({ inApp: z.boolean(), email: z.boolean() }).optional(),
    })
    .parse(await c.req.json())
  const p = c.get('profile')
  if (!env().demoMode) {
    const update: Record<string, unknown> = {}
    if (body.language) update.language = body.language
    if (body.notificationPrefs) update.notification_prefs = body.notificationPrefs
    if (Object.keys(update).length) {
      const { data, error } = await supabaseAdmin()
        .from('profiles')
        .update(update)
        .eq('id', p.id)
        .select('id, role, status, display_name, language, phone, notification_prefs, created_at')
        .single()
      if (error) throw apiError(503, 'profile_update_failed', 'Could not save profile settings')
      return c.json(profileFromRow(data, p.email))
    }
    return c.json(p)
  }
  if (body.language) p.language = body.language
  if (body.notificationPrefs) p.notificationPrefs = body.notificationPrefs
  return c.json(p)
})

const reportInput = z.object({
  category: z.enum(CATEGORIES),
  description: z.string().min(8).max(2000),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().optional(),
  photo: z.string().max(5_500_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/).optional(),
  source: z.enum(['resident', 'worker', 'sensor_simulated']).optional(),
  submitAnyway: z.boolean().optional(),
  linkTo: z.string().optional(),
})

app.post('/reports', async (c) => {
  const me = c.get('profile')
  rateLimit(me.id + ':reports', 30)
  const body = reportInput.parse(await c.req.json())
  if (!env().demoMode) {
    const result = await createLiveReport({ profile: me, ...body })
    if ('possibleDuplicates' in result) return c.json(result, 409)
    return c.json(result, 201)
  }
  if (!pointInPolygon(body.lat, body.lng, store.areas[0].polygon)) {
    throw apiError(422, 'out_of_area', 'This location is outside Greenfield Ward.')
  }
  const dups = findDuplicates({
    category: body.category,
    lat: body.lat,
    lng: body.lng,
    radiusM: store.settings.duplicateRadiusM,
    windowHours: store.settings.duplicateWindowHours,
    candidates: store.reports.filter((r) => !['completed', 'rejected_duplicate'].includes(r.status)),
  })
  if (dups.length && !body.submitAnyway && !body.linkTo) {
    return c.json({ possibleDuplicates: dups }, 409)
  }
  const pr = scorePriority({
    category: body.category,
    createdAt: store.stamp(),
    lat: body.lat,
    lng: body.lng,
    sensitive: store.sensitive,
    repeatCount72h: dups.length,
    settings: store.settings,
  })
  const report = {
    id: store.uid('rep'),
    code: store.nextCode(),
    reporterId: me.role === 'resident' ? me.id : me.role === 'worker' ? me.id : null,
    category: body.category,
    description: body.description,
    lat: body.lat,
    lng: body.lng,
    address: body.address || `${body.lat.toFixed(4)}, ${body.lng.toFixed(4)}`,
    photoPath: body.photo ? `photos/${Date.now()}.jpg` : undefined,
    priorityScore: pr.score,
    priorityLabel: pr.label,
    priorityFactors: pr.factors,
    status: 'submitted' as ReportStatus,
    source: body.source ?? (me.role === 'worker' ? 'worker' as const : 'resident' as const),
    isSimulated: false,
    createdAt: store.stamp(),
    updatedAt: store.stamp(),
    duplicateOf: body.linkTo,
  }
  if (body.photo) store.photos.set(report.photoPath!, { mime: 'image/jpeg', bytes: body.photo })
  store.reports.unshift(report)
  addEvent(report.id, undefined, 'submitted', me, 'Created')
  notify(report.reporterId || me.id, 'received', 'Report received', `${report.code} is in the queue`)
  if (pr.label === 'urgent') notify('user_dispatcher', 'urgent', 'Urgent report', report.code)
  return c.json({ report, duplicates: dups }, 201)
})

app.get('/reports', async (c) => {
  const me = c.get('profile')
  const url = new URL(c.req.url)
  const page = Number(url.searchParams.get('page') || 1)
  const limit = Math.min(50, Number(url.searchParams.get('limit') || 20))
  if (!env().demoMode) {
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1) {
      throw apiError(422, 'invalid_pagination', 'Page and limit must be positive whole numbers')
    }
    return c.json(await listLiveReports({
      profile: me,
      page,
      limit,
      status: url.searchParams.get('status') || undefined,
      category: url.searchParams.get('category') || undefined,
      q: url.searchParams.get('q') || undefined,
    }))
  }
  let rows = [...store.reports]
  if (me.role === 'resident') rows = rows.filter((r) => r.reporterId === me.id)
  if (me.role === 'worker') {
    const mine = new Set(store.assignments.filter((a) => a.workerId === me.id).map((a) => a.reportId))
    rows = rows.filter((r) => mine.has(r.id) || r.reporterId === me.id)
  }
  if (me.role === 'analyst') {
    rows = rows.map((r) => ({ ...r, lat: Math.round(r.lat * 1000) / 1000, lng: Math.round(r.lng * 1000) / 1000 }))
  }
  const status = url.searchParams.get('status')
  const category = url.searchParams.get('category')
  const q = url.searchParams.get('q')?.toLowerCase()
  if (status) rows = rows.filter((r) => r.status === status)
  if (category) rows = rows.filter((r) => r.category === category)
  if (q) rows = rows.filter((r) => r.code.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))
  const total = rows.length
  const data = rows.slice((page - 1) * limit, page * limit)
  return c.json({ data, page, limit, total })
})

app.get('/reports/:id', async (c) => {
  const me = c.get('profile')
  if (!env().demoMode) return c.json(await getLiveReport(c.req.param('id'), me))
  const r = store.reports.find((x) => x.id === c.req.param('id'))
  if (!r) throw apiError(404, 'not_found', 'Report not found')
  assertReportAccess(r, me)
  const classification = store.classifications.filter((x) => x.reportId === r.id).at(-1)
  const timeline = store.events.filter((e) => e.reportId === r.id)
  let photoUrl: string | undefined
  if (r.photoPath && store.photos.has(r.photoPath)) photoUrl = `/api/photos/${encodeURIComponent(r.photoPath)}`
  const loc =
    me.role === 'analyst'
      ? { ...r, lat: Math.round(r.lat * 1000) / 1000, lng: Math.round(r.lng * 1000) / 1000 }
      : r
  return c.json({ report: loc, classification, timeline, photoUrl })
})

app.patch('/reports/:id/status', async (c) => {
  const me = c.get('profile')
  const body = z.object({ status: z.enum(['submitted', 'validated', 'pending_assignment', 'assigned', 'in_progress', 'completed', 'needs_review', 'partially_completed', 'inaccessible', 'rejected_duplicate', 'reopened']), note: z.string().optional() }).parse(await c.req.json())
  const r = mustReport(c.req.param('id'))
  assertReportAccess(r, me)
  try {
    assertTransition(r.status, body.status as ReportStatus, me.role)
  } catch (e) {
    if (e instanceof IllegalTransitionError) throw apiError(422, 'illegal_transition', e.message)
    throw e
  }
  const from = r.status
  r.status = body.status as ReportStatus
  r.updatedAt = store.stamp()
  if (r.status === 'completed') r.completedAt = r.updatedAt
  addEvent(r.id, from, r.status, me, body.note)
  return c.json(r)
})

app.post('/reports/:id/classify', async (c) => {
  const me = c.get('profile')
  rateLimit(me.id + ':classify', 20)
  if (!env().demoMode) return c.json(await classifyLiveReport(c.req.param('id'), me))
  const r = mustReport(c.req.param('id'))
  assertReportAccess(r, me)
  const photo = r.photoPath ? store.photos.get(r.photoPath)?.bytes : undefined
  const result = await classifyReport({ description: r.description, imageBase64: photo?.includes(',') ? photo.split(',')[1] : photo })
  const row = {
    id: store.uid('cls'),
    reportId: r.id,
    label: result.label,
    confidence: result.confidence,
    modelVersion: result.modelVersion,
    visibleEvidence: result.visible_evidence,
    warnings: result.warnings,
    latencyMs: result.latencyMs,
    fallback: result.fallback,
    createdAt: store.stamp(),
  }
  store.classifications.push(row)
  if (result.confidence < env().aiThreshold) {
    const from = r.status
    r.status = 'needs_review'
    addEvent(r.id, from, 'needs_review', me, 'Low-confidence AI — needs review')
  } else if (r.status === 'submitted') {
    r.status = 'validated'
    addEvent(r.id, 'submitted', 'validated', me, 'Auto-validated after classification')
  }
  return c.json(row)
})

app.post('/reports/:id/feedback', async (c) => {
  const me = c.get('profile')
  const r = mustReport(c.req.param('id'))
  assertReportAccess(r, me)
  const body = z.object({ rating: z.number().min(1).max(5), resolved: z.boolean(), comment: z.string() }).parse(await c.req.json())
  const fb = { id: store.uid('fb'), reportId: r.id, ...body, createdAt: store.stamp() }
  store.feedback.push(fb)
  return c.json(fb, 201)
})

app.post('/reports/:id/reopen', async (c) => {
  const me = c.get('profile')
  const r = mustReport(c.req.param('id'))
  if (me.role !== 'resident' || r.reporterId !== me.id) throw apiError(403, 'forbidden', 'Only the reporting resident can reopen this report')
  const body = z.object({ note: z.string().min(4) }).parse(await c.req.json())
  try {
    assertTransition(r.status, 'reopened', me.role)
  } catch {
    throw apiError(422, 'illegal_transition', 'Cannot reopen from this status')
  }
  const from = r.status
  r.status = 'reopened'
  r.updatedAt = store.stamp()
  addEvent(r.id, from, 'reopened', me, body.note)
  notify('user_dispatcher', 'overdue', 'Report reopened', r.code)
  return c.json(r)
})

app.post('/reports/:id/merge', requireRole('dispatcher', 'admin'), async (c) => {
  const me = c.get('profile')
  if (!canMergeDuplicates(me.role)) throw apiError(403, 'forbidden', 'Only dispatcher/admin')
  const body = z.object({ duplicateOf: z.string() }).parse(await c.req.json())
  const r = mustReport(c.req.param('id'))
  if (r.id === body.duplicateOf || !store.reports.some((report) => report.id === body.duplicateOf)) {
    throw apiError(422, 'invalid_duplicate', 'Choose another existing report to merge into')
  }
  const from = r.status
  r.duplicateOf = body.duplicateOf
  r.status = 'rejected_duplicate'
  r.updatedAt = store.stamp()
  addEvent(r.id, from, 'rejected_duplicate', me, `Merged into ${body.duplicateOf}`)
  writeAudit(me.id, 'merge', 'waste_report', r.id, body)
  return c.json(r)
})

app.patch('/reports/:id/priority', requireRole('dispatcher', 'admin'), async (c) => {
  const me = c.get('profile')
  const body = z
    .object({ label: z.enum(['low', 'medium', 'high', 'urgent']), reason: z.string().min(4) })
    .parse(await c.req.json())
  const r = mustReport(c.req.param('id'))
  r.priorityLabel = body.label
  r.priorityFactors.push({ name: 'Dispatcher override', points: 0, explanation: body.reason })
  writeAudit(me.id, 'priority_override', 'waste_report', r.id, body)
  return c.json(r)
})

app.post('/reports/:id/review-ai', requireRole('dispatcher', 'admin', 'resident'), async (c) => {
  const me = c.get('profile')
  const body = z.object({ category: z.enum(CATEGORIES) }).parse(await c.req.json())
  const r = mustReport(c.req.param('id'))
  if (me.role === 'resident' && r.reporterId !== me.id) throw apiError(403, 'forbidden', 'Not your report')
  const last = store.classifications.filter((x) => x.reportId === r.id).at(-1)
  if (!last) throw apiError(404, 'not_found', 'No classification')
  last.reviewedCategory = body.category as Category
  last.reviewedBy = me.id
  r.category = body.category as Category
  if (r.status === 'needs_review') r.status = 'validated'
  return c.json(last)
})

app.post('/assignments', requireRole('dispatcher', 'admin'), async (c) => {
  const me = c.get('profile')
  const body = z
    .object({
      reportId: z.string(),
      workerId: z.string(),
      vehicleId: z.string().optional(),
      teamId: z.string().optional(),
      dueAt: z.string(),
    })
    .parse(await c.req.json())
  const r = mustReport(body.reportId)
  if (r.status === 'submitted') r.status = 'validated'
  if (r.status === 'validated' || r.status === 'reopened') r.status = 'pending_assignment'
  assertTransition(r.status, 'assigned', me.role)
  const a = { id: store.uid('asg'), ...body, createdAt: store.stamp(), createdBy: me.id }
  store.assignments.push(a)
  r.status = 'assigned'
  r.assignmentId = a.id
  r.updatedAt = store.stamp()
  addEvent(r.id, 'pending_assignment', 'assigned', me, `Assigned to ${body.workerId}`)
  notify(body.workerId, 'assigned', 'New assignment', r.code)
  return c.json(a, 201)
})

app.post('/routes/optimise', requireRole('dispatcher', 'admin'), async (c) => {
  const me = c.get('profile')
  const body = z
    .object({
      date: z.string(),
      shiftStart: z.string(),
      shiftEnd: z.string(),
      serviceAreaId: z.string(),
      vehicleIds: z.array(z.string()).min(1).max(10).refine((ids) => new Set(ids).size === ids.length),
      reportIds: z.array(z.string()).max(25).optional(),
      fallback: z.boolean().optional(),
    })
    .parse(await c.req.json())
  const startMin = parseClock(body.shiftStart)
  const endMin = parseClock(body.shiftEnd)
  const shiftMin = endMin - startMin
  if (shiftMin <= 0) throw apiError(422, 'invalid_shift', 'Shift end must be later than shift start')
  if (!store.areas.some((area) => area.id === body.serviceAreaId)) throw apiError(404, 'area_not_found', 'Service area not found')
  const veh = store.vehicles.filter((v) => body.vehicleIds.includes(v.id) && v.available)
  if (veh.length !== body.vehicleIds.length) throw apiError(422, 'vehicle_unavailable', 'Choose available vehicles')
  const eligible = store.reports.filter((r) => ['pending_assignment', 'assigned', 'submitted', 'validated', 'reopened'].includes(r.status))
  const selected = body.reportIds
    ? eligible.filter((r) => body.reportIds!.includes(r.id))
    : eligible.filter((r) => r.id.startsWith('rep_'))
  if (body.reportIds && selected.length !== new Set(body.reportIds).size) {
    throw apiError(422, 'report_unavailable', 'One or more selected reports are not eligible for route planning')
  }

  const solverStops: SolverStop[] = selected.map((r) => ({
    id: r.id,
    lat: r.lat,
    lng: r.lng,
    demand: r.category === 'illegal_dumping' ? 3 : 1,
    serviceMin: 8,
    priorityWeight: r.priorityLabel === 'urgent' ? 4 : r.priorityLabel === 'high' ? 3 : r.priorityLabel === 'medium' ? 2 : 1,
    deadlineMin: r.priorityLabel === 'urgent' ? 90 : 240,
    category: r.category,
  }))
  const depot = store.depots[0]
  const matrix = await travelMatrix([depot, ...solverStops])
  const solved = solveVrp({
    depot,
    stops: solverStops,
    vehicles: veh.map((v) => ({
      id: v.id,
      capacity: v.capacity,
      shiftMin,
      acceptedCategories: v.acceptedCategories,
      restrictions: v.accessRestrictions,
    })),
    matrix,
    timeLimitMs: 2500,
    seed: 42,
    fallback: body.fallback,
  })
  const check = validateSolution(
    solved.optimised.routes,
    solverStops,
    veh.map((v) => ({
      id: v.id,
      capacity: v.capacity,
      shiftMin,
      acceptedCategories: v.acceptedCategories,
      restrictions: v.accessRestrictions,
    })),
    matrix,
  )
  const plan = {
    id: store.uid('plan'),
    date: body.date,
    shiftStart: body.shiftStart,
    shiftEnd: body.shiftEnd,
    serviceAreaId: body.serviceAreaId,
    algorithmVersion: SOLVER_VERSION,
    status: 'proposed' as const,
    metrics: {
      optimised: solved.optimised.metrics,
      nearestNeighbour: solved.nearestNeighbour.metrics,
      original: solved.original.metrics,
    },
    unassigned: solved.optimised.unassigned.map((u) => ({ reportId: u.id, reason: u.reason })),
    createdAt: store.stamp(),
  }
  store.plans.unshift(plan)
  store.stops = store.stops.filter((s) => s.planId !== plan.id)
  for (const route of solved.optimised.routes) {
    route.stopIds.forEach((rid, i) => {
      store.stops.push({
        id: store.uid('stop'),
        planId: plan.id,
        reportId: rid,
        vehicleId: route.vehicleId,
        sequence: i + 1,
        eta: new Date(Date.now() + route.etas[i] * 60000).toISOString(),
        serviceMinutes: 8,
        capacityUnits: 1,
        outcome: 'pending',
      })
    })
  }
  writeAudit(me.id, 'optimise', 'route_plan', plan.id, { check })
  return c.json({ plan, routes: solved.optimised.routes, validation: check, approximate: matrix.approximate })
})

app.get('/routes', requireRole('dispatcher', 'admin', 'analyst'), (c) => c.json({ data: store.plans, page: 1, limit: 50, total: store.plans.length }))

app.get('/routes/:id', requireRole('dispatcher', 'admin', 'analyst'), (c) => {
  const me = c.get('profile')
  const plan = store.plans.find((p) => p.id === c.req.param('id'))
  if (!plan) throw apiError(404, 'not_found', 'Plan not found')
  const stops = store.stops.filter((s) => s.planId === plan.id).map((stop) => ({
    ...stop,
    report: (() => {
      const report = store.reports.find((item) => item.id === stop.reportId)
      return report && me.role === 'analyst'
        ? { ...report, lat: Math.round(report.lat * 1000) / 1000, lng: Math.round(report.lng * 1000) / 1000 }
        : report
    })(),
  }))
  return c.json({ plan, stops, depot: store.depots.find((depot) => depot.serviceAreaId === plan.serviceAreaId) })
})

app.post('/routes/:id/approve', requireRole('dispatcher', 'admin'), async (c) => {
  const me = c.get('profile')
  if (!canApproveRoutes(me.role)) throw apiError(403, 'forbidden', 'Cannot approve')
  const plan = store.plans.find((p) => p.id === c.req.param('id'))
  if (!plan) throw apiError(404, 'not_found', 'Plan not found')
  plan.status = 'approved'
  plan.approvedBy = me.id
  writeAudit(me.id, 'approve_route', 'route_plan', plan.id, {})
  notify('user_worker', 'assigned', 'Route approved', 'Today’s route is ready')
  notify('user_worker2', 'assigned', 'Route approved', 'Today’s route is ready')
  return c.json(plan)
})

app.post('/route-stops/:id/complete', requireRole('worker', 'dispatcher', 'admin'), async (c) => {
  const me = c.get('profile')
  const body = z
    .object({
      outcome: z.enum(['completed', 'partially_completed', 'inaccessible', 'needs_follow_up', 'started']),
      note: z.string().max(500).optional(),
      lat: z.number().min(-90).max(90).optional(),
      lng: z.number().min(-180).max(180).optional(),
      idempotencyKey: z.string().uuid(),
    })
    .parse(await c.req.json())
  const stop = store.stops.find((s) => s.id === c.req.param('id'))
  if (!stop) throw apiError(404, 'not_found', 'Stop not found')
  if (me.role === 'worker' && stop.vehicleId !== workerVehicle(me.id)) {
    throw apiError(403, 'forbidden', 'This stop is not assigned to your route')
  }
  if ((body.lat === undefined) !== (body.lng === undefined)) throw apiError(422, 'invalid_location', 'Latitude and longitude must be provided together')
  const actionKey = `${me.id}:${body.idempotencyKey}`
  const prior = store.actionResults.get(actionKey)
  if (prior) return c.json(prior)
  if (['partially_completed', 'inaccessible', 'needs_follow_up'].includes(body.outcome) && !body.note?.trim()) {
    throw apiError(422, 'note_required', 'A note is required for this outcome')
  }
  const r = mustReport(stop.reportId)
  const mapStatus: Record<string, ReportStatus> = {
    started: 'in_progress',
    completed: 'completed',
    partially_completed: 'partially_completed',
    inaccessible: 'inaccessible',
    needs_follow_up: 'needs_review',
  }
  const next = mapStatus[body.outcome]
  if (r.status === 'assigned' && next !== 'in_progress') {
    assertTransitionForApi(r.status, 'in_progress', me.role)
    r.status = 'in_progress'
    addEvent(r.id, 'assigned', 'in_progress', me, 'Started')
  }
  if (next && r.status !== next) {
    assertTransitionForApi(r.status, next, me.role)
    addEvent(r.id, r.status, next, me, body.note)
    r.status = next
    r.updatedAt = store.stamp()
    if (next === 'completed') r.completedAt = r.updatedAt
  }
  stop.outcome = body.outcome
  stop.note = body.note
  stop.completedAt = body.outcome === 'started' ? undefined : store.stamp()
  if (body.lat !== undefined && body.lng !== undefined) {
    stop.distanceToStopM = haversineM({ lat: body.lat, lng: body.lng }, { lat: r.lat, lng: r.lng })
  }
  const result = { stop, report: r, farFromStop: (stop.distanceToStopM ?? 0) > 150 }
  store.actionResults.set(actionKey, result)
  return c.json(result)
})

app.get('/analytics/summary', (c) => {
  const me = c.get('profile')
  if (!['dispatcher', 'admin', 'analyst'].includes(me.role)) throw apiError(403, 'forbidden', 'Restricted')
  const url = new URL(c.req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  let rows = store.reports.filter((r) => r.isSimulated)
  if (from) rows = rows.filter((r) => r.createdAt >= from)
  if (to) rows = rows.filter((r) => r.createdAt <= to)
  const completed = rows.filter((r) => r.status === 'completed' && r.completedAt)
  const durations = completed.map(
    (r) => (new Date(r.completedAt!).getTime() - new Date(r.createdAt).getTime()) / 36e5,
  )
  const open = rows.filter((r) => !['completed', 'rejected_duplicate'].includes(r.status))
  const completedStops = store.stops.filter((stop) => stop.outcome === 'completed')
  const planDistanceKm = store.plans.reduce((total, plan) => total + plan.metrics.optimised.distanceKm, 0)
  const dueAssignments = store.assignments.filter((assignment) => {
    const report = rows.find((row) => row.id === assignment.reportId)
    return report?.status === 'completed' && Boolean(report.completedAt)
  })
  const onTimeCompletions = dueAssignments.filter((assignment) => {
    const report = rows.find((row) => row.id === assignment.reportId)
    return Boolean(report?.completedAt && new Date(report.completedAt) <= new Date(assignment.dueAt))
  })
  const summary = {
    openRequests: open.length,
    overdue: open.filter((report) => store.assignments.some((assignment) => assignment.reportId === report.id && new Date(assignment.dueAt).getTime() < Date.now())).length,
    byStatus: countBy(rows, (r) => r.status),
    completionRate: rows.length ? completed.length / rows.length : 0,
    onTimeRate: dueAssignments.length ? onTimeCompletions.length / dueAssignments.length : 0,
    avgResolutionH: mean(durations),
    medianResolutionH: percentile(durations, 0.5),
    p90ResolutionH: percentile(durations, 0.9),
    missedCollection: rows.filter((r) => r.category === 'missed_collection').length,
    repeatRate: rows.length ? rows.filter((r) => Boolean(r.duplicateOf)).length / rows.length : 0,
    evidenceRate: completedStops.length ? completedStops.filter((stop) => Boolean(stop.evidencePhoto)).length / completedStops.length : 0,
    dataQuality: rows.length ? rows.filter((r) => Boolean(r.description.trim()) && Number.isFinite(r.lat) && Number.isFinite(r.lng)).length / rows.length : 0,
    kmPerStop: completedStops.length ? planDistanceKm / completedStops.length : 0,
    simulated: true,
  }
  return c.json(summary)
})

app.get('/analytics/sustainability', requireRole('dispatcher', 'admin', 'analyst'), (c) => {
  const plan = store.plans[0]
  const current = plan ? estimatedFuelAndCo2e(plan.metrics.optimised.distanceKm, store.settings.fuelPerKmL, store.settings.emissionKgPerL) : null
  const baseline = plan ? estimatedFuelAndCo2e(plan.metrics.original.distanceKm, store.settings.fuelPerKmL, store.settings.emissionKgPerL) : null
  return c.json({ current, baseline, assumptions: store.settings, badge: 'ESTIMATE', simulated: Boolean(plan) })
})

app.get('/analytics/forecast', requireRole('dispatcher', 'admin', 'analyst'), (c) => {
  const byDay: number[] = []
  for (let i = 13; i >= 0; i--) {
    const day = new Date()
    day.setDate(day.getDate() - i)
    const key = day.toISOString().slice(0, 10)
    byDay.push(store.reports.filter((r) => r.createdAt.slice(0, 10) === key).length)
  }
  const forecast = seasonalNaiveForecast(byDay)
  return c.json({ series: byDay, forecast, badge: 'ESTIMATE' })
})

app.get('/evaluation', requireRole('admin', 'analyst'), (c) => {
  const routePlans = store.plans.map((plan) => ({
    id: plan.id,
    date: plan.date,
    status: plan.status,
    metrics: plan.metrics,
    simulated: store.stops
      .filter((stop) => stop.planId === plan.id)
      .every((stop) => store.reports.find((report) => report.id === stop.reportId)?.isSimulated ?? false),
  }))
  return c.json({
    aiEvaluation: null,
    routePlans,
    simulated: routePlans.some((plan) => plan.simulated),
  })
})

app.get('/hotspots', requireRole('dispatcher', 'admin', 'analyst'), (c) => {
  const open = store.reports.filter((r) => r.id.startsWith('rep_') && r.status !== 'completed')
  const clusters = open.map((r) => ({
    id: r.id,
    lat: c.get('profile').role === 'analyst' ? Math.round(r.lat * 1000) / 1000 : r.lat,
    lng: c.get('profile').role === 'analyst' ? Math.round(r.lng * 1000) / 1000 : r.lng,
    count: 1 + Math.round(r.priorityScore / 30),
    category: r.category,
  }))
  return c.json({ points: clusters, simulated: true })
})

app.get('/bins', requireRole('dispatcher', 'admin', 'analyst'), (c) => c.json({ data: store.bins, page: 1, limit: 50, total: store.bins.length }))

app.post('/sensors/ingest', async (c) => {
  const body = z
    .object({ deviceId: z.string(), apiKey: z.string(), fillLevel: z.number().min(0).max(100), timestamp: z.string() })
    .parse(await c.req.json())
  const bin = store.bins.find((b) => b.id === body.deviceId || b.code === body.deviceId)
  if (!bin) throw apiError(404, 'not_found', 'Unknown device')
  const hashOk = body.apiKey.length >= 8
  if (!hashOk) throw apiError(401, 'bad_device', 'Invalid device key')
  const recent = store.readings.filter((r) => r.binId === bin.id).slice(-6)
  const stuck = recent.length >= 5 && recent.every((r) => r.fillLevel === body.fillLevel)
  if (stuck) {
    bin.flaggedAnomaly = 'stuck_sensor'
    return c.json({ accepted: false, anomaly: 'stuck_sensor', dispatched: false })
  }
  store.readings.push({
    id: store.uid('read'),
    binId: bin.id,
    fillLevel: body.fillLevel,
    timestamp: body.timestamp,
    isSimulated: true,
    valid: true,
  })
  bin.fillLevel = body.fillLevel
  bin.isSimulated = true
  let created = false
  if (body.fillLevel >= 90) {
    const existing = store.reports.find(
      (r) => r.source === 'sensor_simulated' && r.description.includes(bin.code) && r.status !== 'completed',
    )
    if (!existing) {
      store.reports.unshift({
        id: store.uid('rep'),
        code: store.nextCode(),
        reporterId: null,
        category: 'overflowing_bin',
        description: `Predicted overflow from ${bin.code} (SIMULATED sensor)`,
        lat: bin.lat,
        lng: bin.lng,
        address: bin.code,
        priorityScore: 70,
        priorityLabel: 'high',
        priorityFactors: [{ name: 'Sensor threshold', points: 70, explanation: 'Fill ≥ 90%' }],
        status: 'needs_review',
        source: 'sensor_simulated',
        isSimulated: true,
        createdAt: store.stamp(),
        updatedAt: store.stamp(),
      })
      created = true
    }
  }
  return c.json({ accepted: true, created, dispatched: false })
})

app.post('/admin/simulate-sensors', requireRole('admin'), (c) => {
  store.bins.forEach((b) => {
    b.fillLevel = Math.min(100, Math.max(5, b.fillLevel + Math.round(Math.random() * 10 - 3)))
  })
  return c.json({ data: store.bins })
})

app.get('/notifications', (c) => {
  const me = c.get('profile')
  const rows = store.notifications.filter((n) => n.userId === me.id)
  return c.json({ data: rows, page: 1, limit: 50, total: rows.length, unread: rows.filter((n) => !n.read).length })
})

app.patch('/notifications/:id/read', (c) => {
  const n = store.notifications.find((x) => x.id === c.req.param('id') && x.userId === c.get('profile').id)
  if (!n) throw apiError(404, 'not_found', 'Notification not found')
  n.read = true
  return c.json(n)
})

app.get('/admin/users', requireRole('admin'), (c) => c.json({ data: store.profiles, page: 1, limit: 50, total: store.profiles.length }))

app.patch('/admin/users/:id', requireRole('admin'), async (c) => {
  const me = c.get('profile')
  const body = z
    .object({ role: z.enum(['resident', 'worker', 'dispatcher', 'admin', 'analyst']).optional(), status: z.enum(['active', 'suspended', 'invited']).optional() })
    .parse(await c.req.json())
  const u = store.profiles.find((p) => p.id === c.req.param('id'))
  if (!u) throw apiError(404, 'not_found', 'User not found')
  if (body.role) u.role = body.role
  if (body.status) u.status = body.status
  writeAudit(me.id, 'update_user', 'profile', u.id, body)
  return c.json(u)
})

app.get('/admin/settings', requireRole('admin', 'dispatcher'), (c) =>
  c.json({ settings: store.settings, sensitive: store.sensitive, areas: store.areas, vehicles: store.vehicles, depots: store.depots }),
)

app.patch('/admin/settings', requireRole('admin'), async (c) => {
  const body = z
    .object({
      aiThreshold: z.number().min(0).max(1).optional(),
      fuelPerKmL: z.number().optional(),
      emissionKgPerL: z.number().optional(),
      retentionDays: z.number().optional(),
    })
    .parse(await c.req.json())
  Object.assign(store.settings, body)
  writeAudit(c.get('profile').id, 'update_settings', 'system_settings', 'default', body)
  return c.json(store.settings)
})

app.get('/admin/audit', requireRole('admin'), (c) => {
  const url = new URL(c.req.url)
  const page = Number(url.searchParams.get('page') || 1)
  const limit = 50
  const data = store.audit.slice((page - 1) * limit, page * limit)
  return c.json({ data, page, limit, total: store.audit.length })
})

app.get('/admin/vehicles', requireRole('admin', 'dispatcher'), (c) =>
  c.json({ data: store.vehicles, page: 1, limit: 50, total: store.vehicles.length }),
)
app.get('/admin/areas', (c) => c.json({ data: store.areas, page: 1, limit: 50, total: store.areas.length }))
app.get('/lookups/workers', requireRole('dispatcher', 'admin'), (c) =>
  c.json(store.profiles.filter((p) => p.role === 'worker')),
)

app.post('/worker/location', requireRole('worker'), async (c) => {
  const body = z.object({ lat: z.number(), lng: z.number() }).parse(await c.req.json())
  store.workerLocations = store.workerLocations.filter((w) => w.workerId !== c.get('profile').id)
  store.workerLocations.push({ workerId: c.get('profile').id, ...body, at: store.stamp() })
  return c.json({ ok: true })
})

app.get('/worker/locations', requireRole('dispatcher', 'admin'), (c) => c.json(store.workerLocations))

app.get('/worker/route', requireRole('worker', 'dispatcher', 'admin'), (c) => {
  const me = c.get('profile')
  const plan = me.role === 'worker'
    ? store.plans.find((candidate) => candidate.status === 'approved' || candidate.status === 'in_progress')
    : store.plans[0]
  if (!plan) return c.json({ plan: null, stops: [] })
  let stops = store.stops.filter((s) => s.planId === plan.id)
  if (me.role === 'worker') {
    const veh = me.id === 'user_worker' ? 'veh_1' : 'veh_2'
    stops = stops.filter((s) => s.vehicleId === veh)
  }
  const enriched = stops.map((s) => ({ ...s, report: store.reports.find((r) => r.id === s.reportId) }))
  return c.json({ plan, stops: enriched })
})

app.post('/demo/reset', requireRole('admin'), (c) => {
  if (!env().demoMode) throw apiError(403, 'disabled', 'DEMO_MODE is false')
  writeAudit(c.get('profile').id, 'reset_demo', 'system', 'demo', {})
  return c.json({ ok: true, message: 'Demo data retained (in-memory seed is already loaded). Refresh the app.' })
})

app.get('/cron/sensors', (c) => {
  if (c.req.header('authorization') !== `Bearer ${env().cronSecret}`) throw apiError(401, 'cron', 'Bad cron secret')
  return c.json({ ok: true })
})

app.get('/cron/retention', (c) => {
  if (c.req.header('authorization') !== `Bearer ${env().cronSecret}`) throw apiError(401, 'cron', 'Bad cron secret')
  const cut = Date.now() - store.settings.retentionDays * 864e5
  store.workerLocations = store.workerLocations.filter((w) => new Date(w.at).getTime() > cut)
  writeAudit('system', 'retention', 'worker_locations', 'ttl', {})
  return c.json({ ok: true })
})

app.get('/photos/:path', (c) => {
  const p = decodeURIComponent(c.req.param('path'))
  if (c.get('profile').role === 'analyst') throw apiError(403, 'forbidden', 'Analysts cannot access report photos')
  const report = store.reports.find((row) => row.photoPath === p)
  if (!report) throw apiError(404, 'not_found', 'Photo gone')
  assertReportAccess(report, c.get('profile'))
  const file = store.photos.get(p)
  if (!file) throw apiError(404, 'not_found', 'Photo gone')
  return c.json({ dataUrl: file.bytes.startsWith('data:') ? file.bytes : `data:${file.mime};base64,${file.bytes}` })
})

function workerVehicle(workerId: string) {
  return workerId === 'user_worker' ? 'veh_1' : 'veh_2'
}

function parseClock(value: string) {
  const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(value)
  if (!match) throw apiError(422, 'invalid_shift', 'Shift times must use 24-hour HH:mm format')
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function assertTransitionForApi(from: ReportStatus, to: ReportStatus, role: UserRole) {
  try {
    assertTransition(from, to, role)
  } catch (error) {
    if (error instanceof IllegalTransitionError) throw apiError(422, 'illegal_transition', error.message)
    throw error
  }
}

function assertReportAccess(report: { id: string; reporterId: string | null }, profile: Profile) {
  if (profile.role === 'dispatcher' || profile.role === 'admin' || profile.role === 'analyst') return
  if (profile.role === 'resident' && report.reporterId === profile.id) return
  if (
    profile.role === 'worker' &&
    (report.reporterId === profile.id || store.assignments.some((assignment) => assignment.reportId === report.id && assignment.workerId === profile.id))
  ) return
  throw apiError(403, 'forbidden', 'You do not have access to this report')
}

function mustReport(id: string | undefined) {
  const r = store.reports.find((x) => x.id === id)
  if (!r) throw apiError(404, 'not_found', 'Report not found')
  return r
}

function addEvent(reportId: string, from: ReportStatus | undefined, to: ReportStatus, actor: Profile, note?: string) {
  store.events.push({
    id: store.uid('ev'),
    reportId,
    fromStatus: from,
    toStatus: to,
    actorId: actor.id,
    actorRole: actor.role,
    note,
    createdAt: store.stamp(),
  })
}

function notify(userId: string, kind: AppNotificationKind, title: string, body: string) {
  store.notifications.unshift({
    id: store.uid('nt'),
    userId,
    title,
    body,
    kind,
    read: false,
    createdAt: store.stamp(),
  })
}

type AppNotificationKind = 'received' | 'assigned' | 'resolved' | 'urgent' | 'overdue'

function writeAudit(actorId: string, action: string, entity: string, entityId: string, change: Record<string, unknown>) {
  store.audit.unshift({ id: store.uid('aud'), actorId, action, entity, entityId, change, createdAt: store.stamp() })
}

function countBy<T>(rows: T[], fn: (r: T) => string) {
  const o: Record<string, number> = {}
  for (const r of rows) o[fn(r)] = (o[fn(r)] || 0) + 1
  return o
}

export default app
