import { Bell, Menu, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, type NavLinkRenderProps } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Drawer, Logo, useToast } from '@/components/ui'
import { homeFor, useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import CommandPalette from '@/components/CommandPalette'
import DemoGuide from '@/components/DemoGuide'

const LINKS: Record<string, { to: string; key: string }[]> = {
  resident: [
    { to: '/report', key: 'report' },
    { to: '/my-reports', key: 'myReports' },
  ],
  worker: [
    { to: '/worker', key: 'worker' },
    { to: '/worker/route', key: 'routes' },
  ],
  dispatcher: [
    { to: '/dispatch', key: 'dispatch' },
    { to: '/routes', key: 'routes' },
    { to: '/analytics', key: 'analytics' },
    { to: '/hotspots', key: 'hotspots' },
    { to: '/bins', key: 'bins' },
  ],
  admin: [
    { to: '/admin', key: 'admin' },
    { to: '/dispatch', key: 'dispatch' },
    { to: '/analytics', key: 'analytics' },
    { to: '/bins', key: 'bins' },
    { to: '/evaluation', key: 'evaluation' },
    { to: '/transparency', key: 'transparency' },
  ],
  analyst: [
    { to: '/analytics', key: 'analytics' },
    { to: '/hotspots', key: 'hotspots' },
    { to: '/evaluation', key: 'evaluation' },
  ],
}

export default function AppShell() {
  const { profile, loading, logout } = useAuth()
  const nav = useNavigate()
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const [collapsed, setCollapsed] = useState(false)
  const [notes, setNotes] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<{ id: string; title: string; body: string }[]>([])
  const [demoMode, setDemoMode] = useState(false)
  const [liveReady, setLiveReady] = useState(false)

  useEffect(() => {
    api<{ demoMode: boolean; supabaseReady: boolean; serviceAreas: string[] }>('/health')
      .then((status) => {
        setDemoMode(status.demoMode)
        setLiveReady(status.supabaseReady && status.serviceAreas.length > 0)
      })
      .catch(() => setDemoMode(false))
  }, [])

  useEffect(() => {
    if (!loading && !profile) nav('/login')
  }, [loading, profile, nav])

  useEffect(() => {
    if (!profile || !demoMode) return
    api<{ unread: number; data: { id: string; title: string; body: string }[] }>('/notifications').then((r) => {
      setUnread(r.unread)
      setItems(r.data)
    }).catch(() => {
      setUnread(0)
      setItems([])
    })
  }, [profile, demoMode])

  if (loading || !profile) {
    return <div className="grid min-h-screen place-items-center text-white/50">Loading EcoBrain…</div>
  }

  const links = demoMode
    ? LINKS[profile.role]
    : profile.role === 'resident'
      ? liveReady
        ? LINKS.resident
        : [{ to: '/my-reports', key: 'myReports' }]
      : []

  return (
    <div className="flex min-h-screen bg-[#07090A] text-white">
      <aside className={`hidden border-r border-white/10 md:flex md:flex-col ${collapsed ? 'w-20' : 'w-64'} p-4 transition-all`}>
        <Logo className={collapsed ? 'scale-90' : ''} />
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }: NavLinkRenderProps) =>
                `min-h-[44px] rounded-2xl px-3 py-2 text-sm ${isActive ? 'bg-white text-black' : 'text-white/70 hover:bg-white/5'}`
              }
            >
              {t(`nav.${l.key}`)}
            </NavLink>
          ))}
        </nav>
        <button className="text-left text-xs text-white/40" onClick={() => setCollapsed((v) => !v)}>
          {collapsed ? '»' : 'Collapse'}
        </button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Menu className="md:hidden" />
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-white/30" />
            <input className="min-h-[44px] w-full rounded-full border border-white/10 bg-white/5 pl-10 pr-4 text-sm" placeholder="Search reports · Ctrl/K" />
          </div>
          <select
            className="min-h-[44px] rounded-full border border-white/10 bg-transparent px-3 text-sm"
            value={i18n.language}
            onChange={(e) => {
              const language = e.target.value as 'en' | 'hi' | 'kn'
              void i18n.changeLanguage(language)
              void api('/me', { method: 'PATCH', body: JSON.stringify({ language }) })
            }}
          >
            <option value="en">EN</option>
            <option value="hi">HI</option>
            <option value="kn">KN</option>
          </select>
          {demoMode && (
            <button className="relative min-h-[44px] min-w-[44px]" onClick={() => setNotes(true)} aria-label="Notifications">
              <Bell />
              {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#6EE7A8]" />}
            </button>
          )}
          <Button variant="secondary" className="px-4 py-2" onClick={() => { void logout().then(() => nav('/')).catch((error: Error) => toast(`Signed out locally; server sign-out failed: ${error.message}`)) }}>
            {profile.displayName}
          </Button>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">
          {!demoMode && !liveReady && (
            <div role="status" className="mb-5 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">
              {profile.role === 'resident'
                ? 'The live service area is not configured yet. Reporting will become available after the Supabase setup is complete.'
                : 'This account has no live operational modules enabled yet. Dispatch, fleet, routes, worker tracking, analytics, and sensor data are unavailable until real operational records are configured.'}
            </div>
          )}
          {!demoMode && liveReady && profile.role !== 'resident' && (
            <div role="status" className="mb-5 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">
              This account has no live operational modules enabled yet. Dispatch, fleet, routes, worker tracking, analytics, and sensor data are unavailable until real operational records are configured.
            </div>
          )}
          <Outlet />
        </main>
        <nav className="flex justify-around border-t border-white/10 p-2 md:hidden">
          {links.slice(0, 4).map((l) => (
            <NavLink key={l.to} to={l.to} className="min-h-[44px] px-2 text-xs text-white/70">
              {t(`nav.${l.key}`)}
            </NavLink>
          ))}
        </nav>
      </div>
      <Drawer open={notes} onClose={() => setNotes(false)}>
        <h2 className="font-instrument-serif text-2xl">Notifications</h2>
        <div className="mt-4 space-y-3">
          {items.map((n) => (
            <div key={n.id} className="rounded-2xl border border-white/10 p-3">
              <p className="text-sm">{n.title}</p>
              <p className="text-xs text-white/50">{n.body}</p>
            </div>
          ))}
        </div>
      </Drawer>
      <CommandPalette />
      {demoMode && <DemoGuide />}
      <a className="sr-only" href={homeFor(profile.role)}>
        skip
      </a>
    </div>
  )
}
