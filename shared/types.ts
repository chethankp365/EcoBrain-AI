export const USER_ROLES = ['resident', 'worker', 'dispatcher', 'admin', 'analyst'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const ACCOUNT_STATUSES = ['active', 'suspended', 'invited'] as const
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]

export const REPORT_STATUSES = [
  'submitted',
  'validated',
  'pending_assignment',
  'assigned',
  'in_progress',
  'completed',
  'needs_review',
  'partially_completed',
  'inaccessible',
  'rejected_duplicate',
  'reopened',
] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

export const CATEGORIES = [
  'overflowing_bin',
  'missed_collection',
  'litter_hotspot',
  'illegal_dumping',
  'recyclable_material',
  'other',
] as const
export type Category = (typeof CATEGORIES)[number]

export const PRIORITY_LABELS = ['low', 'medium', 'high', 'urgent'] as const
export type PriorityLabel = (typeof PRIORITY_LABELS)[number]

export const REPORT_SOURCES = ['resident', 'worker', 'sensor_simulated'] as const
export type ReportSource = (typeof REPORT_SOURCES)[number]

export const ROUTE_PLAN_STATUSES = ['proposed', 'approved', 'in_progress', 'completed'] as const
export type RoutePlanStatus = (typeof ROUTE_PLAN_STATUSES)[number]

export const STOP_OUTCOMES = [
  'pending',
  'started',
  'completed',
  'partially_completed',
  'inaccessible',
  'needs_follow_up',
] as const
export type StopOutcome = (typeof STOP_OUTCOMES)[number]

export type PriorityFactor = { name: string; points: number; explanation: string }

export type PriorityResult = {
  score: number
  label: PriorityLabel
  factors: PriorityFactor[]
}

export type DuplicateSuggestion = {
  reportId: string
  reportCode: string
  distanceM: number
  ageHours: number
  category: Category
  status: ReportStatus
}

export type ApiError = { error: { code: string; message: string; details?: unknown } }

export type Paginated<T> = {
  data: T[]
  page: number
  limit: number
  total: number
}

export type Profile = {
  id: string
  email: string
  role: UserRole
  status: AccountStatus
  displayName: string
  language: 'en' | 'hi' | 'kn'
  phone?: string
  notificationPrefs: { inApp: boolean; email: boolean }
  createdAt: string
}

export type ServiceArea = {
  id: string
  name: string
  polygon: [number, number][]
  rules: string
}

export type Depot = {
  id: string
  name: string
  lat: number
  lng: number
  serviceAreaId: string
}

export type Vehicle = {
  id: string
  name: string
  type: string
  capacity: number
  available: boolean
  depotId: string
  acceptedCategories: Category[]
  accessRestrictions: string[]
}

export type Team = { id: string; name: string; serviceAreaId: string }

export type WasteReport = {
  id: string
  code: string
  reporterId: string | null
  category: Category
  description: string
  lat: number
  lng: number
  address: string
  photoPath?: string
  priorityScore: number
  priorityLabel: PriorityLabel
  priorityFactors: PriorityFactor[]
  status: ReportStatus
  source: ReportSource
  duplicateOf?: string
  isSimulated: boolean
  createdAt: string
  updatedAt: string
  completedAt?: string
  assignmentId?: string
}

export type ClassificationResult = {
  id: string
  reportId: string
  label: string
  confidence: number
  modelVersion: string
  visibleEvidence: string
  warnings: string[]
  latencyMs: number
  reviewedCategory?: Category
  reviewedBy?: string
  fallback: boolean
  createdAt: string
}

export type Assignment = {
  id: string
  reportId: string
  workerId: string
  vehicleId?: string
  teamId?: string
  dueAt: string
  createdAt: string
  createdBy: string
}

export type RouteStop = {
  id: string
  planId: string
  reportId: string
  vehicleId: string
  sequence: number
  eta: string
  serviceMinutes: number
  capacityUnits: number
  outcome: StopOutcome
  note?: string
  evidencePhoto?: string
  completedAt?: string
  distanceToStopM?: number
}

export type RouteMetrics = {
  distanceKm: number
  timeMin: number
  stopsServed: number
  constraintViolations: number
  runtimeMs: number
  unassigned: number
  approximate?: boolean
  fallback?: boolean
}

export type RoutePlan = {
  id: string
  date: string
  shiftStart: string
  shiftEnd: string
  serviceAreaId: string
  algorithmVersion: string
  status: RoutePlanStatus
  approvedBy?: string
  metrics: {
    optimised: RouteMetrics
    nearestNeighbour: RouteMetrics
    original: RouteMetrics
  }
  unassigned: { reportId: string; reason: string }[]
  createdAt: string
}

export type StatusEvent = {
  id: string
  reportId: string
  fromStatus?: ReportStatus
  toStatus: ReportStatus
  actorId: string
  actorRole: UserRole
  note?: string
  createdAt: string
}

export type BinDevice = {
  id: string
  code: string
  lat: number
  lng: number
  fillLevel: number
  isSimulated: boolean
  flaggedAnomaly?: string
}

export type SensorReading = {
  id: string
  binId: string
  fillLevel: number
  timestamp: string
  isSimulated: boolean
  valid: boolean
}

export type Feedback = {
  id: string
  reportId: string
  rating: number
  resolved: boolean
  comment: string
  createdAt: string
}

export type AppNotification = {
  id: string
  userId: string
  title: string
  body: string
  kind: 'received' | 'assigned' | 'resolved' | 'urgent' | 'overdue'
  read: boolean
  createdAt: string
}

export type AuditLog = {
  id: string
  actorId: string
  action: string
  entity: string
  entityId: string
  change: Record<string, unknown>
  createdAt: string
}

export type SystemSettings = {
  aiThreshold: number
  priorityWeights: {
    category: number
    age: number
    sensitive: number
    repeat: number
    fill: number
  }
  fuelPerKmL: number
  emissionKgPerL: number
  retentionDays: number
  duplicateRadiusM: number
  duplicateWindowHours: number
}

export type SensitiveLocation = {
  id: string
  name: string
  kind: 'hospital' | 'school' | 'market'
  lat: number
  lng: number
}
