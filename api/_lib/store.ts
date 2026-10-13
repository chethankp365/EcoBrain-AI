import { scorePriority } from '../../shared/priority'
import type {
  Assignment,
  AuditLog,
  BinDevice,
  ClassificationResult,
  Depot,
  Feedback,
  AppNotification,
  Profile,
  RoutePlan,
  RouteStop,
  SensitiveLocation,
  SensorReading,
  ServiceArea,
  StatusEvent,
  SystemSettings,
  Team,
  Vehicle,
  WasteReport,
} from '../../shared/types'

export const DEMO_PASSWORD = 'EcoBrain!2026'

const now = () => new Date().toISOString()
const hoursAgo = (h: number) => new Date(Date.now() - h * 36e5).toISOString()
const daysAgo = (d: number) => new Date(Date.now() - d * 864e5).toISOString()
const id = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`

export const GREENFIELD: ServiceArea = {
  id: 'area_greenfield',
  name: 'Greenfield Ward',
  polygon: [
    [12.955, 77.57],
    [12.99, 77.57],
    [12.99, 77.62],
    [12.955, 77.62],
  ],
  rules: 'Residential mixed waste, no industrial loads after 18:00',
}

const settings: SystemSettings = {
  aiThreshold: 0.65,
  priorityWeights: { category: 10, age: 10, sensitive: 10, repeat: 10, fill: 10 },
  fuelPerKmL: 0.22,
  emissionKgPerL: 2.68,
  retentionDays: 90,
  duplicateRadiusM: 50,
  duplicateWindowHours: 72,
}

const sensitive: SensitiveLocation[] = [
  { id: 'sens_1', name: 'Greenfield General Hospital', kind: 'hospital', lat: 12.9732, lng: 77.5898 },
  { id: 'sens_2', name: 'Ward Primary School', kind: 'school', lat: 12.9684, lng: 77.5991 },
  { id: 'sens_3', name: 'Russell Market', kind: 'market', lat: 12.976, lng: 77.601 },
]

const profiles: Profile[] = [
  { id: 'user_resident', email: 'resident@ecobrain.demo', role: 'resident', status: 'active', displayName: 'Asha Rao', language: 'en', notificationPrefs: { inApp: true, email: false }, createdAt: daysAgo(40) },
  { id: 'user_worker', email: 'worker@ecobrain.demo', role: 'worker', status: 'active', displayName: 'Imran Khan', language: 'en', notificationPrefs: { inApp: true, email: false }, createdAt: daysAgo(40) },
  { id: 'user_worker2', email: 'worker2@ecobrain.demo', role: 'worker', status: 'active', displayName: 'Lakshmi N', language: 'en', notificationPrefs: { inApp: true, email: false }, createdAt: daysAgo(40) },
  { id: 'user_dispatcher', email: 'dispatcher@ecobrain.demo', role: 'dispatcher', status: 'active', displayName: 'Priya Menon', language: 'en', notificationPrefs: { inApp: true, email: true }, createdAt: daysAgo(40) },
  { id: 'user_admin', email: 'admin@ecobrain.demo', role: 'admin', status: 'active', displayName: 'Dev Admin', language: 'en', notificationPrefs: { inApp: true, email: true }, createdAt: daysAgo(40) },
  { id: 'user_analyst', email: 'analyst@ecobrain.demo', role: 'analyst', status: 'active', displayName: 'Rahul Iyer', language: 'en', notificationPrefs: { inApp: true, email: false }, createdAt: daysAgo(40) },
]

const depot: Depot = { id: 'depot_1', name: 'Cubbon Depot', lat: 12.9763, lng: 77.5929, serviceAreaId: GREENFIELD.id }
const teams: Team[] = [{ id: 'team_a', name: 'Alpha Crew', serviceAreaId: GREENFIELD.id }]
const vehicles: Vehicle[] = [
  { id: 'veh_1', name: 'Compactor 12', type: 'compactor', capacity: 18, available: true, depotId: depot.id, acceptedCategories: ['overflowing_bin', 'missed_collection', 'litter_hotspot', 'other'], accessRestrictions: [] },
  { id: 'veh_2', name: 'Tipper 07', type: 'tipper', capacity: 12, available: true, depotId: depot.id, acceptedCategories: ['illegal_dumping', 'recyclable_material', 'litter_hotspot', 'other'], accessRestrictions: ['narrow_lane'] },
]

const stops: { lat: number; lng: number; address: string }[] = [
  { lat: 12.9716, lng: 77.5946, address: 'MG Road junction' },
  { lat: 12.975, lng: 77.605, address: 'Commercial Street lane' },
  { lat: 12.966, lng: 77.588, address: 'Shivaji Nagar block 4' },
  { lat: 12.9698, lng: 77.5972, address: 'Church Street bin 12' },
  { lat: 12.9738, lng: 77.5901, address: 'Hospital service road' },
  { lat: 12.9782, lng: 77.5994, address: 'Cantonment back alley' },
  { lat: 12.9644, lng: 77.6018, address: 'Austin Town park' },
  { lat: 12.981, lng: 77.586, address: 'Palace Road north' },
  { lat: 12.962, lng: 77.592, address: 'Richmond Town corner' },
  { lat: 12.97, lng: 77.61, address: 'Ulsoor lake edge' },
  { lat: 12.9744, lng: 77.612, address: 'Murphy Town market' },
  { lat: 12.9598, lng: 77.598, address: 'Agram dump watch' },
  { lat: 12.9688, lng: 77.5832, address: 'Vasanth Nagar flats' },
  { lat: 12.977, lng: 77.5805, address: 'Race Course west' },
  { lat: 12.9655, lng: 77.6066, address: 'Jog Palya street' },
  { lat: 12.9722, lng: 77.5877, address: 'Cubbon Park south gate' },
  { lat: 12.96, lng: 77.58, address: 'Ashok Nagar bin cluster' },
  { lat: 12.983, lng: 77.605, address: 'Fraser Town lane 9' },
  { lat: 12.973, lng: 77.5899, address: 'Hospital overflow bay' },
  { lat: 12.9718, lng: 77.5948, address: 'MG Road duplicate check' },
  { lat: 12.9714, lng: 77.5944, address: 'MG Road second report' },
  { lat: 12.9662, lng: 77.5881, address: 'Shivaji Nagar related' },
]

const cats = [
  'overflowing_bin',
  'missed_collection',
  'litter_hotspot',
  'illegal_dumping',
  'recyclable_material',
  'other',
] as const

function makeReport(i: number, extra: Partial<WasteReport> = {}): WasteReport {
  const loc = stops[i % stops.length]
  const category = extra.category ?? cats[i % cats.length]
  const createdAt = extra.createdAt ?? hoursAgo(4 + i * 3)
  const temp: WasteReport = {
    id: extra.id ?? `rep_${String(i + 1).padStart(3, '0')}`,
    code: extra.code ?? `EB-2026-${String(100000 + i).slice(1)}`,
    reporterId: extra.reporterId === undefined ? 'user_resident' : extra.reporterId,
    category,
    description: extra.description ?? `${category.replaceAll('_', ' ')} reported at ${loc.address}`,
    lat: loc.lat,
    lng: loc.lng,
    address: loc.address,
    priorityScore: 0,
    priorityLabel: 'low',
    priorityFactors: [],
    status: extra.status ?? 'pending_assignment',
    source: extra.source ?? 'resident',
    isSimulated: true,
    createdAt,
    updatedAt: createdAt,
    ...extra,
  }
  const pr = scorePriority({
    category: temp.category,
    createdAt: temp.createdAt,
    lat: temp.lat,
    lng: temp.lng,
    sensitive,
    repeatCount72h: i % 5 === 0 ? 2 : 0,
    fillLevel: i % 4 === 0 ? 86 : undefined,
    settings,
  })
  temp.priorityScore = pr.score
  temp.priorityLabel = pr.label
  temp.priorityFactors = pr.factors
  return temp
}

const reports: WasteReport[] = []
for (let i = 0; i < 22; i++) reports.push(makeReport(i))
reports[0].status = 'needs_review'
reports[4].status = 'inaccessible'
reports[4].description = 'Gate locked — inaccessible stop'
reports[18].status = 'submitted'
reports[18].priorityLabel = 'urgent'
reports[19].status = 'submitted'
reports[20].status = 'submitted'
reports[21].status = 'submitted'

const historical: WasteReport[] = []
for (let d = 1; d <= 90; d++) {
  const n = 2 + (d % 4)
  for (let k = 0; k < n; k++) {
    const created = daysAgo(d)
    const completed = new Date(new Date(created).getTime() + (6 + (d % 18)) * 36e5).toISOString()
    historical.push(
      makeReport(1000 + d * 10 + k, {
        id: `hist_${d}_${k}`,
        code: `EB-2026-${String(200000 + d * 10 + k).slice(1)}`,
        status: 'completed',
        createdAt: created,
        completedAt: completed,
        updatedAt: completed,
        isSimulated: true,
      }),
    )
  }
}

const bins: BinDevice[] = Array.from({ length: 12 }, (_, i) => ({
  id: `bin_${i + 1}`,
  code: `SB-${String(i + 1).padStart(2, '0')}`,
  lat: 12.96 + (i % 5) * 0.004,
  lng: 77.58 + Math.floor(i / 5) * 0.008,
  fillLevel: [22, 41, 58, 73, 91, 34, 66, 80, 12, 95, 48, 61][i],
  isSimulated: true,
}))

const readings: SensorReading[] = bins.map((b, i) => ({
  id: `read_${i}`,
  binId: b.id,
  fillLevel: b.fillLevel,
  timestamp: hoursAgo(i),
  isSimulated: true,
  valid: true,
}))

const events: StatusEvent[] = reports.slice(0, 8).map((r, i) => ({
  id: `ev_${i}`,
  reportId: r.id,
  toStatus: r.status,
  actorId: 'user_resident',
  actorRole: 'resident',
  note: 'Submitted via resident app',
  createdAt: r.createdAt,
}))

const notifications: AppNotification[] = [
  {
    id: 'nt_1',
    userId: 'user_dispatcher',
    title: 'Urgent overflow near hospital',
    body: 'Report EB-2026-000118 needs review.',
    kind: 'urgent',
    read: false,
    createdAt: hoursAgo(1),
  },
  {
    id: 'nt_2',
    userId: 'user_resident',
    title: 'Report received',
    body: 'We logged your waste report.',
    kind: 'received',
    read: false,
    createdAt: hoursAgo(2),
  },
]

const audit: AuditLog[] = [
  {
    id: 'aud_1',
    actorId: 'user_admin',
    action: 'seed',
    entity: 'system',
    entityId: 'demo',
    change: { demo: true },
    createdAt: daysAgo(1),
  },
]

export type Session = { token: string; userId: string; createdAt: number }

class MemoryStore {
  profiles = profiles
  passwords = new Map(profiles.map((profile) => [profile.email.toLowerCase(), DEMO_PASSWORD]))
  areas = [GREENFIELD]
  depots = [depot]
  teams = teams
  vehicles = vehicles
  reports = [...reports, ...historical]
  classifications: ClassificationResult[] = []
  assignments: Assignment[] = []
  plans: RoutePlan[] = []
  stops: RouteStop[] = []
  events = events
  bins = bins
  readings = readings
  feedback: Feedback[] = []
  notifications = notifications
  audit = audit
  settings = settings
  sensitive = sensitive
  sessions: Session[] = []
  actionResults = new Map<string, { stop: RouteStop; report: WasteReport; farFromStop: boolean }>()
  workerLocations: { workerId: string; lat: number; lng: number; at: string }[] = []
  photos = new Map<string, { mime: string; bytes: string }>()
  reportSeq = 100123
  demoPassword = DEMO_PASSWORD

  nextCode() {
    this.reportSeq += 1
    return `EB-2026-${String(this.reportSeq).padStart(6, '0')}`
  }

  uid(p: string) {
    return id(p)
  }

  stamp() {
    return now()
  }

  hoursAgo = hoursAgo
}

export const store = new MemoryStore()
export { sensitive, settings }
