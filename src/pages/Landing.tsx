import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Play, Recycle, Route, Shield, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, GlassCard, Logo, Magnetic } from '@/components/ui'
import { api } from '@/lib/api'

const VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204103_f607742e-09da-4cf5-bb06-4e67b0a531de.mp4'
const PILOT_AREA = 'Ramaswamy Palya Ward 1, Bengaluru'

const NAV = [
  { href: '#how', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#roles', label: 'Roles' },
  { href: '#impact', label: 'Impact' },
]

const STEPS = [
  'Report or detect',
  'Validate',
  'Classify and prioritise',
  'Queue and assign',
  'Optimise',
  'Collect and update',
  'Verify',
  'Learn and report',
]
const LIVE_STEPS = ['Create an account', 'Report a collection issue', 'Review the AI suggestion', 'Track the saved report']
const LIVE_FEATURES = [
  ['Accounts and RBAC', 'Supabase sign-up, authenticated sessions, and role-aware profiles.'],
  ['Reporting', 'Resident reports and private photos are saved in Supabase with access checks.'],
  ['AI image classification', 'Gemini suggestions and review details are saved with each report.'],
]

const FEATURES = [
  ['Accounts and RBAC', 'Live resident sign-up, sign-in and profiles. Staff role provisioning is not enabled.'],
  ['Reporting', 'Resident reports, private photos and report history are stored in Supabase for the configured pilot area.'],
  ['AI image classification', 'Gemini suggestions are generated server-side and saved for human review.'],
  ['Priority + duplicates', 'Transparent scores. Nearby matches suggested, never silently dropped.'],
  ['Smart scheduling', 'Shift planner that ranks work by deadline, age and capacity.'],
  ['Route optimisation', 'TypeScript VRP with baselines, validator and human approval.'],
  ['Worker interface', 'Installable PWA, offline outbox, huge touch targets.'],
  ['Supervisor dashboard', 'Live queue, map, exceptions and assignment.'],
  ['Maps and hotspots', 'Clusters, heat and recurring polygons — privacy-aware.'],
  ['Analytics and sustainability', 'Documented KPIs. Fuel/CO2e always labelled ESTIMATE.'],
  ['Notifications', 'In-app realtime with optional email. Deduped, preference-aware.'],
  ['Audit trail and feedback', 'Immutable events, reopen/dispute, star ratings.'],
  ['IoT smart bins', 'Simulated sensors, anomaly flags, predicted overflow for confirmation.'],
]

export default function Landing() {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [optimised, setOptimised] = useState(true)
  const [vehicles, setVehicles] = useState(2)
  const [urgent, setUrgent] = useState<number | null>(4)
  const [demoMode, setDemoMode] = useState(false)
  const [serviceAreas, setServiceAreas] = useState<string[]>([])
  const [supabaseReady, setSupabaseReady] = useState(false)
  const [geminiConfigured, setGeminiConfigured] = useState(false)

  useEffect(() => {
    api<{ demoMode: boolean; serviceAreas: string[]; supabaseReady: boolean; geminiConfigured: boolean }>('/health')
      .then((health) => {
        setDemoMode(health.demoMode)
        setServiceAreas(health.serviceAreas)
        setSupabaseReady(health.supabaseReady)
        setGeminiConfigured(health.geminiConfigured)
      })
      .catch(() => setDemoMode(false))
  }, [])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const dist = optimised ? 18.4 - vehicles * 0.4 : 26.1
  const mins = optimised ? 74 - vehicles * 3 : 102

  const path = useMemo(() => {
    const pts = [20, 40, 70, 90, 120, 150, 180, 210, 250, 280, 310, 340]
    return pts
      .map((x, i) => {
        const y = urgent === i ? 40 : optimised ? 70 + Math.sin(i / 1.7 + vehicles) * 28 : 50 + i * 6
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
  }, [optimised, vehicles, urgent])
  const liveReady = supabaseReady && serviceAreas.length > 0
  const featureStatus = (title: string) => {
    const isLiveFeature = LIVE_FEATURES.some(([name]) => name === title)
    if (!isLiveFeature) return { label: 'DEMO ONLY', tone: 'sim' as const }
    if (title === 'Accounts and RBAC') {
      return supabaseReady
        ? { label: 'LIVE', tone: 'ai' as const }
        : { label: 'SETUP REQUIRED', tone: 'medium' as const }
    }
    if (title === 'AI image classification' && !geminiConfigured) {
      return { label: 'SETUP REQUIRED', tone: 'medium' as const }
    }
    return liveReady
      ? { label: 'LIVE PILOT', tone: 'ai' as const }
      : { label: 'PILOT SETUP', tone: 'medium' as const }
  }

  return (
    <div className="bg-[#07090A] text-white">
      <section className="relative h-screen w-full overflow-hidden">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={VIDEO}
          autoPlay
          muted
          loop
          playsInline
          poster=""
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-[#07090A]" />
        <div className="relative z-10 flex h-full flex-col">
          <nav className="flex items-center justify-between px-6 py-5 md:px-12 md:py-6 lg:px-16">
            <Logo />
            <div className="hidden items-center gap-8 md:flex">
              {NAV.map((n) => (
                <a key={n.href} href={n.href} className="text-sm font-light text-white/80 transition-colors duration-200 hover:text-white">
                  {n.label}
                </a>
              ))}
            </div>
            <div className="hidden items-center gap-4 md:flex">
              <Link to="/login" className="text-sm font-light text-white/80 hover:text-white">
                Sign in
              </Link>
              <Link to="/signup" className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black">
                Get Started
              </Link>
            </div>
            <button aria-label="Menu" className="relative h-11 w-11 md:hidden" onClick={() => setOpen((v) => !v)}>
              <span className={`absolute left-3 top-[14px] h-[2px] w-6 rounded-full bg-white transition duration-500 ease-cinematic ${open ? 'translate-y-2 rotate-45' : ''}`} />
              <span className={`absolute left-3 top-[20px] h-[2px] w-4 rounded-full bg-white transition duration-500 ease-cinematic ${open ? 'opacity-0' : ''}`} />
              <span className={`absolute left-3 top-[26px] h-[2px] w-6 rounded-full bg-white transition duration-500 ease-cinematic ${open ? '-translate-y-2 -rotate-45' : ''}`} />
            </button>
          </nav>

          {open && (
            <div className="fixed inset-0 z-50 md:hidden">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
              <div className="relative flex h-full flex-col px-6 py-5">
                <div className="flex items-center justify-between">
                  <Logo />
                  <button aria-label="Close" className="h-11 w-11" onClick={() => setOpen(false)}>
                    <span className="sr-only">Close</span>
                  </button>
                </div>
                <div className="flex flex-1 flex-col items-center justify-center">
                  {[...NAV, { href: '/login', label: 'Sign in' }].map((n, i) => (
                    <motion.a
                      key={n.label}
                      href={n.href}
                      onClick={() => setOpen(false)}
                      initial={reduce ? false : { y: 32, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.15 + i * 0.08, duration: 0.5, ease: [0.76, 0, 0.24, 1] }}
                      className="w-full border-b border-white/10 py-4 text-center font-instrument-serif text-4xl text-white hover:pl-4 sm:text-5xl"
                    >
                      {n.label}
                    </motion.a>
                  ))}
                </div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}>
                  <Link to="/signup" className="block rounded-full bg-white py-4 text-center font-medium text-black">
                    Get Started
                  </Link>
                </motion.div>
              </div>
            </div>
          )}

          <div className="flex flex-1 flex-col items-center justify-start px-6 pt-4 text-center sm:pt-6 md:pt-8 lg:pt-10">
            <h1 className="max-w-5xl font-instrument-serif text-2xl leading-[1.1] text-white sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl">
              <span className="whitespace-nowrap">WASTE <span className="italic font-instrument-serif">meets</span> AI</span>
              <br />
              <span className="whitespace-nowrap">ROUTES <span className="italic font-instrument-serif">for</span> CLEANER</span>
              <br />
              CITIES
            </h1>
            <p className="mt-4 max-w-md text-sm font-light leading-relaxed text-white/70 md:mt-5 md:text-base">
              <span className="block">Report it. Prioritise it. Route it.</span>
              {liveReady
                ? 'AI-assisted waste collection with real reports stored for the Bengaluru pilot.'
                : 'AI-assisted waste collection, with a real resident-reporting pilot being set up in Bengaluru.'}
            </p>
            <div className="mt-5 flex flex-col items-center gap-4 sm:flex-row md:mt-6">
              <Magnetic>
                <Link to="/report">
                  <Button className="group">
                    Report an Issue
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </Button>
                </Link>
              </Magnetic>
              <a href="#demo">
                <Button variant="secondary">
                  <Play className="h-4 w-4" /> Watch Demo
                </Button>
              </a>
            </div>
          </div>

          <div className="relative z-10 mb-6 flex justify-center px-4">
            <div className="glass flex max-w-3xl items-center gap-6 overflow-hidden px-5 py-3 text-xs text-white/70">
              <Badge tone="sim">SIMULATED</Badge>
              {liveReady
                ? <span className="whitespace-nowrap">{serviceAreas.join(' · ')} · Live reports are stored separately</span>
                : <span className="whitespace-nowrap">Demo scenario only · Selected pilot: {PILOT_AREA} · Setup in progress</span>}
            </div>
          </div>
          <div className="mb-8 flex justify-center text-[11px] tracking-[0.3em] text-white/40">SCROLL</div>
        </div>
      </section>

      {demoMode ? <section id="impact" className="mx-auto grid max-w-6xl gap-4 px-6 py-16 md:grid-cols-4">
        {[
          ['12,480', 'Requests handled'],
          ['9.4h', 'Avg resolution'],
          ['18 km', 'Saved per shift'],
          ['93%', 'On-time rate'],
        ].map(([v, l]) => (
          <GlassCard key={l} className="p-6">
            <Badge tone="sim">SIMULATED</Badge>
            <div className="mt-3 font-instrument-serif text-4xl">{v}</div>
            <div className="text-sm text-white/50">{l}</div>
          </GlassCard>
        ))}
      </section> : <section id="impact" className="mx-auto max-w-6xl px-6 py-16">
        <GlassCard className="p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Pilot status</p>
          <p className="mt-3 font-instrument-serif text-3xl">{serviceAreas.join(', ') || `${PILOT_AREA} · boundary setup pending`}</p>
          <p className="mt-2 text-sm text-white/50">The selected pilot boundary is based on the Greater Bengaluru Authority 2025 Ward 1 dataset. No service-volume or sustainability metrics are shown until real operational data exists.</p>
        </GlassCard>
      </section>}

      <section id="how" className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">Workflow</p>
        <h2 className="mt-2 font-instrument-serif text-4xl md:text-6xl">How it works</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {(demoMode ? STEPS : LIVE_STEPS).map((s, i) => (
            <motion.div key={s} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="glass p-5">
              <div className="text-[#6EE7A8]">{String(i + 1).padStart(2, '0')}</div>
              <div className="mt-2 font-medium">{s}</div>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="demo" className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-instrument-serif text-4xl md:text-6xl">Interactive route demo</h2>
            <p className="mt-2 text-sm text-white/50">Simulated scenario only. Demo actions never write to the live database.</p>
          </div>
          <div className="flex gap-2">
            <Button variant={optimised ? 'primary' : 'secondary'} onClick={() => setOptimised(true)}>
              Optimised
            </Button>
            <Button variant={!optimised ? 'primary' : 'secondary'} onClick={() => setOptimised(false)}>
              Original order
            </Button>
          </div>
        </div>
        <GlassCard className="mt-8 p-6">
          <svg viewBox="0 0 360 140" className="h-48 w-full">
            <path d={path} fill="none" stroke="#6EE7A8" strokeWidth="2" />
            {Array.from({ length: 12 }).map((_, i) => (
              <circle
                key={i}
                cx={20 + i * 29}
                cy={urgent === i ? 40 : 70}
                r={urgent === i ? 7 : 4}
                fill={urgent === i ? '#f87171' : '#fff'}
                className="cursor-pointer"
                onClick={() => setUrgent(i)}
              />
            ))}
            <rect x="8" y="110" width="14" height="14" fill="#B6F36B" />
          </svg>
          <div className="mt-4 flex flex-wrap items-center gap-6 text-sm">
            <span>
              {dist.toFixed(1)} km · {Math.round(mins)} min
            </span>
            <label className="flex items-center gap-3 text-white/60">
              Vehicles
              <input type="range" min={1} max={4} value={vehicles} onChange={(e) => setVehicles(Number(e.target.value))} />
              {vehicles}
            </label>
            <span className="text-white/40">Click a stop to mark urgent</span>
          </div>
        </GlassCard>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-instrument-serif text-4xl md:text-6xl">13 capabilities, clearly labelled</h2>
        <p className="mt-3 max-w-3xl text-sm text-white/55">Live account and resident-report integrations are distinct from simulated operational demos. Demo-only features never create live records.</p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {FEATURES.map(([t, d]) => {
            const status = featureStatus(t)
            return (
              <GlassCard key={t} className="p-6 transition hover:border-[#6EE7A8]/40 hover:shadow-[0_0_40px_rgba(110,231,168,.12)]">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Sparkles className="h-4 w-4 text-[#6EE7A8]" />
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <h3 className="font-medium">{t}</h3>
                <p className="mt-2 text-sm text-white/55">{d}</p>
              </GlassCard>
            )
          })}
        </div>
      </section>

      {demoMode && <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-instrument-serif text-4xl">What is genuinely AI?</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            ['Workflow automation', 'Rules, queues, notifications — not a model.'],
            ['AI-assisted interpretation', 'Gemini vision/text with confidence and human override.'],
            ['Predictive planning', 'Seasonal-naive + moving average. ESTIMATE, with MAE vs naive.'],
            ['Combinatorial optimisation', 'Custom VRP solver. Recommendation, not a guarantee.'],
          ].map(([t, d]) => (
            <GlassCard key={t} className="p-6">
              <h3 className="font-instrument-serif text-2xl">{t}</h3>
              <p className="mt-2 text-sm text-white/60">{d}</p>
            </GlassCard>
          ))}
        </div>
      </section>}

      <Roles />

      <section className="mx-auto max-w-6xl px-6 py-20">
        <GlassCard className="p-8 md:p-12">
          <Shield className="text-[#6EE7A8]" />
          <h2 className="mt-4 font-instrument-serif text-4xl">Trust, privacy, human in the loop</h2>
          <p className="mt-3 max-w-2xl text-white/60">
            {demoMode
              ? 'Role-based access, minimal data, retention jobs, signed photo URLs, and dispatchers who approve every route. Predictions are never presented as proof.'
              : 'Account sessions and resident report access are enforced by the server. AI results remain suggestions, not proof; operational modules stay disabled until they use live records.'}
          </p>
        </GlassCard>
      </section>

      <section className="px-6 pb-24 text-center">
        <h2 className="font-instrument-serif text-5xl">Ready to clean a city?</h2>
        <div className="mt-6 flex justify-center gap-4">
          <Link to="/signup">
            <Button>Get Started</Button>
          </Link>
          <Link to="/login">
            <Button variant="secondary">Sign in</Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-10 text-sm text-white/40">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-6">
          <Logo />
          <div className="flex gap-6">
            <Link to="/transparency">Transparency</Link>
            {demoMode && <Link to="/evaluation">Evaluation</Link>}
            <a href="#features">Features</a>
          </div>
          <span>© 2026 EcoBrain AI{demoMode ? ' · simulated demo data labelled as such' : ' · Bengaluru resident pilot'}</span>
        </div>
      </footer>
    </div>
  )
}

function Roles() {
  const [role, setRole] = useState('Resident')
  const copy: Record<string, string> = {
    Resident: 'Snap a photo, drop a pin, track the timeline.',
    Worker: 'Next-stop card, navigate, complete or mark inaccessible.',
    Dispatcher: 'Queue, map, assign, optimise, approve.',
    Admin: 'Users, areas, thresholds, audit, retention.',
    Analyst: 'KPIs, hotspots with ~100m rounding, forecasts.',
  }
  return (
    <section id="roles" className="mx-auto max-w-6xl px-6 py-20">
      <h2 className="font-instrument-serif text-4xl md:text-6xl">Explore the demo roles</h2>
      <p className="mt-3 text-sm text-white/55">These role previews are illustrative; only resident account and report flows are connected to live data.</p>
      <div className="mt-8 flex flex-wrap gap-2">
        {Object.keys(copy).map((r) => (
          <button key={r} onClick={() => setRole(r)} className={`min-h-[44px] rounded-full px-4 ${role === r ? 'bg-white text-black' : 'border border-white/20'}`}>
            {r}
          </button>
        ))}
      </div>
      <GlassCard className="mt-6 flex min-h-[220px] items-center gap-6 p-8">
        {role === 'Worker' ? <Route className="text-[#6EE7A8]" /> : <Recycle className="text-[#6EE7A8]" />}
        <div>
          <h3 className="font-instrument-serif text-3xl">{role}</h3>
          <p className="mt-2 text-white/60">{copy[role]}</p>
        </div>
      </GlassCard>
    </section>
  )
}
