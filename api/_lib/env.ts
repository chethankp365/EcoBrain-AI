export function env() {
  return {
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    supabaseAnon: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
    serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '',
    geminiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    aiThreshold: Number(process.env.AI_CONFIDENCE_THRESHOLD || 0.65),
    routingProvider: (process.env.ROUTING_PROVIDER || 'osrm') as 'osrm' | 'google',
    osrm: process.env.OSRM_BASE_URL || 'https://router.project-osrm.org',
    googleMaps: process.env.GOOGLE_MAPS_API_KEY || '',
    resend: process.env.RESEND_API_KEY || '',
    cronSecret: process.env.CRON_SECRET || '',
    demoMode: (process.env.DEMO_MODE ?? 'false') !== 'false',
    origin: process.env.VITE_APP_ORIGIN || 'http://localhost:5173',
  }
}

export function usingSupabase() {
  const e = env()
  return Boolean(e.supabaseUrl && e.supabaseAnon && e.serviceRole)
}
