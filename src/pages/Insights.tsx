import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MapContainer, TileLayer, CircleMarker, Polygon, Popup } from 'react-leaflet'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { Badge, Button, GlassCard, Input } from '@/components/ui'
import { TRANSPARENCY_FEATURES } from '@shared/transparency'
import { USER_ROLES, type UserRole } from '@shared/types'
import 'leaflet/dist/leaflet.css'

type AnalyticsSummary = {
  openRequests: number
  overdue: number
  byStatus: Record<string, number>
  completionRate: number
  onTimeRate: number
  avgResolutionH: number
  medianResolutionH: number
  p90ResolutionH: number
  missedCollection: number
  repeatRate: number
  evidenceRate: number
  dataQuality: number
  kmPerStop: number
  simulated: boolean
}

type AdminData = {
  settings: { aiThreshold: number; fuelPerKmL: number; emissionKgPerL: number; retentionDays: number }
  sensitive: { id: string; name: string; kind: string }[]
}

type HotspotPoint = { id: string; lat: number; lng: number; count: number; category: string }
type BinRow = { id: string; code: string; fillLevel: number; lat: number; lng: number; isSimulated: boolean }
type AdminUser = { id: string; displayName: string; email: string; role: UserRole; status: string }
type AuditRow = { id: string; actorId: string; action: string; entity: string; createdAt: string }

export function AnalyticsPage() {
  const summary = useQuery({ queryKey: ['analytics-summary'], queryFn: () => api<AnalyticsSummary>('/analytics/summary') })
  const sustainability = useQuery({ queryKey: ['analytics-sustainability'], queryFn: () => api<any>('/analytics/sustainability') })
  const forecast = useQuery({ queryKey: ['analytics-forecast'], queryFn: () => api<any>('/analytics/forecast') })
  const data = summary.data
  const metrics = [
    ['Open requests', data?.openRequests],
    ['Overdue', data?.overdue],
    ['Completion rate', data ? `${(data.completionRate * 100).toFixed(0)}%` : undefined],
    ['On-time rate', data ? `${(data.onTimeRate * 100).toFixed(0)}%` : undefined],
    ['Average resolution', data ? `${data.avgResolutionH.toFixed(1)} h` : undefined],
    ['Median resolution', data ? `${data.medianResolutionH.toFixed(1)} h` : undefined],
    ['90th percentile', data ? `${data.p90ResolutionH.toFixed(1)} h` : undefined],
    ['Missed collections', data?.missedCollection],
  ]
  const chart = Object.entries(data?.byStatus ?? {}).map(([status, count]) => ({ status: status.replaceAll('_', ' '), count }))

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#6EE7A8]">Operations</p>
          <h1 className="mt-2 font-instrument-serif text-4xl">Analytics</h1>
        </div>
        <Badge tone="sim">SIMULATED SEED DATA</Badge>
      </header>
      {summary.isLoading ? <p role="status" className="text-white/50">Loading operational metrics…</p> : null}
      {summary.isError ? <p role="alert" className="text-red-200">Could not load analytics. {(summary.error as Error).message}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <GlassCard key={label} className="p-5">
            <p className="text-xs text-white/50">{label}</p>
            <p className="mt-3 font-instrument-serif text-3xl">{value ?? '—'}</p>
            <p className="mt-2 text-[11px] text-white/35">Seeded demo data · SIMULATED</p>
          </GlassCard>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="glass p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium">Requests by status</h2>
            <Badge tone="sim">SIMULATED</Badge>
          </div>
          <div className="mt-4 h-64" aria-label="Bar chart of requests by status">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 30, left: -20 }}>
                <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
                <XAxis dataKey="status" angle={-25} textAnchor="end" interval={0} tick={{ fill: 'rgba(255,255,255,.55)', fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: 'rgba(255,255,255,.55)', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#111715', border: '1px solid #34413b', borderRadius: 8 }} />
                <Bar dataKey="count" fill="#6EE7A8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="space-y-4">
          <GlassCard className="p-5">
            <div className="flex items-center justify-between"><h2 className="font-medium">Route forecast</h2><Badge tone="est">ESTIMATE</Badge></div>
            {forecast.data?.forecast?.length ? <p className="mt-4 text-sm text-white/70">Next weekday demand estimate: {forecast.data.forecast.at(-1)} requests</p> : <p className="mt-4 text-sm text-white/50">Insufficient data for a forecast.</p>}
            <p className="mt-2 text-xs text-white/35">Statistical example from the seeded demo series; not a service commitment.</p>
          </GlassCard>
          <GlassCard className="p-5">
            <div className="flex items-center justify-between"><h2 className="font-medium">Sustainability</h2><Badge tone="est">ESTIMATE</Badge></div>
            <p className="mt-4 text-sm text-white/70">Estimated fuel: {sustainability.data?.current?.fuelL ?? '—'} L</p>
            <p className="mt-1 text-sm text-white/70">Estimated CO2e: {sustainability.data?.current?.co2eKg ?? '—'} kg</p>
            <p className="mt-2 text-xs text-white/35">Calculated from configured assumptions, not measured vehicle emissions.</p>
          </GlassCard>
        </section>
      </div>
    </div>
  )
}

export function HotspotsPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['hotspots'], queryFn: () => api<{ points: HotspotPoint[]; simulated: boolean }>('/hotspots') })
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.2em] text-[#6EE7A8]">Location intelligence</p><h1 className="mt-2 font-instrument-serif text-4xl">Hotspots</h1></div><Badge tone="sim">SIMULATED</Badge></header>
      {isLoading && <p role="status" className="text-white/50">Loading hotspot data…</p>}
      {isError && <p role="alert" className="text-red-200">Could not load hotspots.</p>}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="h-[65vh] min-h-80 overflow-hidden rounded-xl border border-white/10">
          <MapContainer center={[12.972, 77.595]} zoom={14} className="h-full w-full">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
            <Polygon positions={[[12.955, 77.57], [12.99, 77.57], [12.99, 77.62], [12.955, 77.62]]} pathOptions={{ color: '#6EE7A8', fillOpacity: 0.04 }} />
            {data?.points.map((point: HotspotPoint) => <CircleMarker key={point.id} center={[point.lat, point.lng]} radius={Math.min(14, 5 + point.count)} pathOptions={{ color: '#ef8354', fillColor: '#ef8354', fillOpacity: 0.68 }}><Popup>{point.category.replaceAll('_', ' ')} · illustrative repeat weight {point.count}</Popup></CircleMarker>)}
          </MapContainer>
        </div>
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Open reports · {data?.points.length ?? 0}</h2>
          {data?.points.map((point: HotspotPoint) => <GlassCard key={point.id} className="p-3"><p className="text-sm">{point.category.replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-white/45">{point.lat.toFixed(3)}, {point.lng.toFixed(3)} · SIMULATED</p></GlassCard>)}
        </section>
      </div>
      <p className="text-xs text-white/40">Markers use demo priority weighting, not a statistical cluster analysis. Analyst coordinates are rounded by the API.</p>
    </div>
  )
}

export function AdminPage() {
  const client = useQueryClient()
  const { profile } = useAuth()
  const settings = useQuery({ queryKey: ['admin-settings'], queryFn: () => api<AdminData>('/admin/settings') })
  const users = useQuery({ queryKey: ['admin-users'], queryFn: () => api<{ data: AdminUser[] }>('/admin/users') })
  const audit = useQuery({ queryKey: ['admin-audit'], queryFn: () => api<{ data: AuditRow[] }>('/admin/audit') })
  const bins = useQuery({ queryKey: ['bins'], queryFn: () => api<{ data: BinRow[] }>('/bins') })
  const [threshold, setThreshold] = useState<number>()
  const save = useMutation({ mutationFn: () => api('/admin/settings', { method: 'PATCH', body: JSON.stringify({ aiThreshold: threshold ?? settings.data?.settings.aiThreshold }) }), onSuccess: () => void client.invalidateQueries({ queryKey: ['admin-settings'] }) })
  const updateUser = useMutation({ mutationFn: ({ id, role }: { id: string; role: UserRole }) => api(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) }), onSuccess: () => void client.invalidateQueries({ queryKey: ['admin-users'] }) })
  const simulate = useMutation({ mutationFn: () => api('/admin/simulate-sensors', { method: 'POST' }), onSuccess: () => void client.invalidateQueries({ queryKey: ['bins'] }) })
  const reset = useMutation({ mutationFn: () => api('/demo/reset', { method: 'POST' }) })
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header><p className="text-xs uppercase tracking-[0.2em] text-[#6EE7A8]">Configuration</p><h1 className="mt-2 font-instrument-serif text-4xl">Administration</h1></header>
      {profile?.role !== 'admin' && <p role="alert" className="text-red-200">Administrator access is required.</p>}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4"><h2 className="text-lg">Settings</h2><GlassCard className="space-y-4 p-5"><label className="block text-sm">AI confidence threshold <Input className="mt-2" type="number" min="0" max="1" step="0.01" value={threshold ?? settings.data?.settings.aiThreshold ?? ''} onChange={(e) => setThreshold(Number(e.target.value))} /></label><p className="text-xs text-white/40">Fuel and emissions factors: {settings.data?.settings.fuelPerKmL ?? '—'} L/km × {settings.data?.settings.emissionKgPerL ?? '—'} kg/L · ESTIMATE assumptions.</p><Button onClick={() => save.mutate()} disabled={save.isPending || threshold === undefined}>Save threshold</Button></GlassCard></div>
        <div className="space-y-4"><div className="flex items-center justify-between gap-3"><h2 className="text-lg">Simulated bins</h2><Badge tone="sim">SIMULATED</Badge></div><GlassCard className="space-y-3 p-5">{bins.data?.data.map((bin: BinRow) => <div key={bin.id}><div className="flex justify-between text-sm"><span>{bin.code}</span><span>{bin.fillLevel}%</span></div><div className="mt-1 h-1.5 rounded bg-white/10"><div className="h-1.5 rounded bg-[#6EE7A8]" style={{ width: `${bin.fillLevel}%` }} /></div></div>)}<Button variant="secondary" onClick={() => simulate.mutate()} disabled={simulate.isPending}>Simulate readings</Button></GlassCard></div>
      </section>
      <section className="space-y-3"><h2 className="text-lg">Users and roles</h2><div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full text-left text-sm"><thead className="text-white/45"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Status</th></tr></thead><tbody>{users.data?.data.map((user: AdminUser) => <tr key={user.id} className="border-t border-white/10"><td className="p-3">{user.displayName}</td><td className="p-3">{user.email}</td><td className="p-3"><select aria-label={`Role for ${user.displayName}`} className="min-h-11 rounded-lg border border-white/15 bg-[#111715] px-2" value={user.role} onChange={(e) => updateUser.mutate({ id: user.id, role: e.target.value as UserRole })}>{USER_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}</select></td><td className="p-3">{user.status}</td></tr>)}</tbody></table></div></section>
      <section className="space-y-3"><h2 className="text-lg">Audit log</h2><div className="space-y-2">{audit.data?.data.map((row: AuditRow) => <div key={row.id} className="flex flex-wrap justify-between gap-2 border-b border-white/10 py-2 text-sm"><span>{row.action} · {row.entity}</span><span className="text-white/40">{row.actorId} · {new Date(row.createdAt).toLocaleString()}</span></div>)}</div></section>
      <section className="border-t border-white/10 pt-5"><Button variant="secondary" onClick={() => reset.mutate()} disabled={reset.isPending}>Reset demo data</Button><p className="mt-2 text-xs text-white/40">DEMO_MODE only. Reset currently reloads the process-local seed rather than modifying a durable database.</p></section>
    </div>
  )
}

export function EvaluationPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['evaluation'], queryFn: () => api<any>('/evaluation') })
  return <div className="mx-auto max-w-6xl space-y-6"><header><p className="text-xs uppercase tracking-[0.2em] text-[#6EE7A8]">Quality and evidence</p><h1 className="mt-2 font-instrument-serif text-4xl">Evaluation</h1></header>{isLoading && <p role="status">Loading evaluation data…</p>}{isError && <p role="alert" className="text-red-200">Evaluation data could not be loaded.</p>}<GlassCard className="p-5"><h2 className="font-medium">AI classification</h2>{data?.aiEvaluation ? <pre className="mt-4 overflow-auto text-xs">{JSON.stringify(data.aiEvaluation, null, 2)}</pre> : <p className="mt-3 text-sm text-white/60">No evaluation run yet. Accuracy metrics are not available until labelled images are evaluated.</p>}</GlassCard><section><div className="flex items-center gap-3"><h2 className="text-lg">Route baselines</h2>{data?.simulated && <Badge tone="sim">SIMULATION RESULTS</Badge>}</div><div className="mt-3 space-y-3">{data?.routePlans?.map((plan: any) => <GlassCard key={plan.id} className="grid gap-3 p-4 sm:grid-cols-3"><span>{plan.date} · {plan.status}</span><span>Optimised: {plan.metrics.optimised.distanceKm} km / {plan.metrics.optimised.stopsServed} stops</span><span>Original: {plan.metrics.original.distanceKm} km / {plan.metrics.original.stopsServed} stops</span></GlassCard>)}</div>{!data?.routePlans?.length && <p className="mt-3 text-sm text-white/50">No route evaluation scenarios yet.</p>}</section></div>
}

export function TransparencyPage() {
  const labels = { implemented: 'Implemented', simulated: 'Simulated', partial: 'Partial', future: 'Future scope' }
  const tones = { implemented: 'bg-emerald-300/10 text-emerald-200', simulated: 'bg-amber-300/10 text-amber-100', partial: 'bg-orange-300/10 text-orange-100', future: 'bg-white/10 text-white/60' }
  return <div className="mx-auto max-w-6xl space-y-6"><header><p className="text-xs uppercase tracking-[0.2em] text-[#6EE7A8]">Product status</p><h1 className="mt-2 font-instrument-serif text-4xl">Transparency</h1><p className="mt-3 max-w-2xl text-sm text-white/55">Demo capabilities, synthetic outputs, incomplete integrations, and future work are distinguished below.</p></header><div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-white/5 text-xs uppercase text-white/45"><tr><th className="p-3">Area</th><th className="p-3">Capability</th><th className="p-3">Status</th><th className="p-3">Evidence / limitation</th></tr></thead><tbody>{TRANSPARENCY_FEATURES.map((feature) => <tr key={feature.feature} className="border-t border-white/10"><td className="p-3 text-white/60">{feature.area}</td><td className="p-3">{feature.feature}</td><td className="p-3"><span className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs ${tones[feature.status]}`}>{labels[feature.status]}</span></td><td className="p-3 text-white/50">{feature.evidence}</td></tr>)}</tbody></table></div></div>
}

export function BinsPage() {
  const { data } = useQuery({ queryKey: ['bins'], queryFn: () => api<{ data: BinRow[] }>('/bins') })
  return <div className="mx-auto max-w-7xl space-y-5"><header className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-[#6EE7A8]">Sensor examples</p><h1 className="mt-2 font-instrument-serif text-4xl">Smart bins</h1></div><Badge tone="sim">SIMULATED</Badge></header><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data?.data.map((bin: BinRow) => <GlassCard key={bin.id} className="p-4"><div className="flex justify-between"><h2>{bin.code}</h2><span className="text-sm">{bin.fillLevel}%</span></div><div className="mt-3 h-2 rounded-full bg-white/10"><div className="h-2 rounded-full bg-[#6EE7A8]" style={{ width: `${bin.fillLevel}%` }} /></div><p className="mt-2 text-xs text-white/40">Synthetic fill reading</p></GlassCard>)}</div><p className="text-xs text-white/40">No physical devices are connected. Sensor thresholds never dispatch work automatically.</p></div>
}
