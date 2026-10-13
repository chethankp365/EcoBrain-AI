export type FeatureStatus = 'implemented' | 'simulated' | 'partial' | 'future'

export type TransparencyFeature = {
  area: string
  feature: string
  status: FeatureStatus
  evidence: string
}

export const TRANSPARENCY_FEATURES: TransparencyFeature[] = [
  { area: 'Accounts and access', feature: 'Supabase Auth, resident profiles, and server-side session checks', status: 'implemented', evidence: 'Live Supabase sign-up, sign-in, refresh, recovery, and profile reads' },
  { area: 'Accounts and access', feature: 'Staff role provisioning and administration', status: 'future', evidence: 'New accounts are residents; staff operations are not enabled in live mode' },
  { area: 'Resident reporting', feature: 'Report creation, private photos, and status history', status: 'implemented', evidence: 'Live reports are persisted in Supabase within the configured pilot boundary' },
  { area: 'AI classification', feature: 'Gemini suggestion saved for human review', status: 'partial', evidence: 'Server-side classification is persisted; accuracy has not been evaluated' },
  { area: 'Priority and duplicates', feature: 'Rule-based priority factors and duplicate suggestions', status: 'partial', evidence: 'Applied during live report creation; sensitivity datasets are not configured' },
  { area: 'Dispatch and routes', feature: 'Vehicle route recommendation and baselines', status: 'simulated', evidence: 'Demo-only VRP solver; live dispatch is disabled until real fleet data is configured' },
  { area: 'Worker experience', feature: 'Worker route actions and offline action queue', status: 'partial', evidence: 'Browser IndexedDB queue; device-level sync is not yet verified' },
  { area: 'Notifications', feature: 'In-app and email notification delivery', status: 'simulated', evidence: 'Demo-only in-memory notifications; no live delivery transport configured' },
  { area: 'Analytics', feature: 'Seeded historical KPIs and forecast examples', status: 'simulated', evidence: 'Synthetic history; not operational measurements' },
  { area: 'Sustainability', feature: 'Fuel and emissions calculations', status: 'simulated', evidence: 'Estimates use configurable assumptions, not measured fleet data' },
  { area: 'Smart bins', feature: 'Bin readings and predicted overflow examples', status: 'simulated', evidence: 'Synthetic sensor readings; no physical devices connected' },
  { area: 'Audit', feature: 'Persistent operational audit trail', status: 'simulated', evidence: 'Live report status history is persisted; administrative audit features remain demo-only' },
  { area: 'Deployment', feature: 'Supabase-backed pilot and public production hosting', status: 'partial', evidence: 'Supabase is configured for local development; public app hosting is not deployed' },
]
