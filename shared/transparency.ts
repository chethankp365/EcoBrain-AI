export type FeatureStatus = 'implemented' | 'simulated' | 'partial' | 'future'

export type TransparencyFeature = {
  area: string
  feature: string
  status: FeatureStatus
  evidence: string
}

export const TRANSPARENCY_FEATURES: TransparencyFeature[] = [
  { area: 'Accounts and access', feature: 'Role-based demo sessions and server role checks', status: 'implemented', evidence: 'Demo API authentication and role middleware' },
  { area: 'Accounts and access', feature: 'Persistent Supabase Auth and row-level security', status: 'future', evidence: 'Requires Supabase migrations and project credentials' },
  { area: 'Resident reporting', feature: 'Report creation, tracking, feedback, and reopen flow', status: 'implemented', evidence: 'Report API and resident pages' },
  { area: 'AI classification', feature: 'Gemini suggestion with deterministic fallback', status: 'partial', evidence: 'Server classifier; accuracy has not been evaluated' },
  { area: 'Priority and duplicates', feature: 'Rule-based priority factors and duplicate suggestions', status: 'implemented', evidence: 'Shared scoring and duplicate modules' },
  { area: 'Dispatch and routes', feature: 'Vehicle route recommendation and baselines', status: 'implemented', evidence: 'TypeScript VRP solver; dispatcher approval required' },
  { area: 'Worker experience', feature: 'Worker route actions and offline action queue', status: 'partial', evidence: 'Browser IndexedDB queue; device-level sync is not yet verified' },
  { area: 'Notifications', feature: 'In-app notifications in the demo store', status: 'simulated', evidence: 'In-memory notifications; no realtime transport configured' },
  { area: 'Analytics', feature: 'Seeded historical KPIs and forecast examples', status: 'simulated', evidence: 'Synthetic history; not operational measurements' },
  { area: 'Sustainability', feature: 'Fuel and emissions calculations', status: 'simulated', evidence: 'Estimates use configurable assumptions, not measured fleet data' },
  { area: 'Smart bins', feature: 'Bin readings and predicted overflow examples', status: 'simulated', evidence: 'Synthetic sensor readings; no physical devices connected' },
  { area: 'Audit', feature: 'In-memory audit events and read-only viewer', status: 'partial', evidence: 'Demo events are not durable across server restarts' },
  { area: 'Deployment', feature: 'Supabase-backed persistence and production deployment', status: 'future', evidence: 'Requires Supabase project setup and production environment variables' },
]
