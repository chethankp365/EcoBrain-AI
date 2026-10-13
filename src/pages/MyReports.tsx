import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Badge, Button, GlassCard, Input, Select, Timeline } from '@/components/ui'
import { api } from '@/lib/api'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import type { WasteReport } from '@shared/types'

export default function MyReports() {
  const { id } = useParams()
  if (id) return <Detail id={id} />
  return <List />
}

function List() {
  const { data, refetch } = useQuery({
    queryKey: ['reports'],
    queryFn: () => api<{ data: WasteReport[] }>('/reports?limit=50'),
  })
  return (
    <div>
      <h1 className="font-instrument-serif text-4xl">My reports</h1>
      <div className="mt-4 flex gap-2">
        <Input placeholder="Search" onBlur={() => void refetch()} />
        <Select>
          <option value="">All statuses</option>
        </Select>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {data?.data.map((r: WasteReport) => (
          <a key={r.id} href={`/my-reports/${r.id}`} className="glass block p-5">
            <div className="flex items-center justify-between">
              <span className="font-medium">{r.code}</span>
              <Badge tone={r.priorityLabel}>{r.priorityLabel}</Badge>
            </div>
            <p className="mt-2 text-sm text-white/60">{r.category.replaceAll('_', ' ')}</p>
            <p className="text-xs text-white/40">{r.status} · {new Date(r.createdAt).toLocaleString()}</p>
            {r.isSimulated && <Badge tone="sim">SIMULATED</Badge>}
          </a>
        ))}
      </div>
    </div>
  )
}

function Detail({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ['report', id],
    queryFn: () => api<any>(`/reports/${id}`),
  })
  if (!data) return <p>Loading…</p>
  const r = data.report
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h1 className="font-instrument-serif text-4xl">{r.code}</h1>
        <div className="mt-3 flex gap-2">
          <Badge tone={r.priorityLabel}>{r.priorityLabel}</Badge>
          <Badge>{r.status.replaceAll('_', ' ')}</Badge>
        </div>
        <p className="mt-4 text-white/70">{r.description}</p>
        <GlassCard className="mt-6 p-5">
          <p className="text-xs text-white/40">Why this priority?</p>
          {r.priorityFactors?.map((f: any) => (
            <div key={f.name} className="mt-2">
              <div className="flex justify-between text-xs">
                <span>{f.name}</span>
                <span>{f.points}</span>
              </div>
              <div className="h-1 rounded bg-white/10">
                <div className="h-1 rounded bg-[#6EE7A8]" style={{ width: `${Math.min(100, f.points)}%` }} />
              </div>
            </div>
          ))}
        </GlassCard>
        <div className="mt-6">
          <Timeline
            items={(data.timeline || []).map((e: any) => ({
              title: e.toStatus,
              meta: `${e.actorRole} · ${new Date(e.createdAt).toLocaleString()}`,
              note: e.note,
            }))}
          />
        </div>
        {r.status === 'completed' && (
          <GlassCard className="mt-6 p-5">
            <p>Was it resolved?</p>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <Button key={n} variant="secondary" className="px-3" onClick={() => void api(`/reports/${id}/feedback`, { method: 'POST', body: JSON.stringify({ rating: n, resolved: n >= 4, comment: 'via app' }) })}>
                  {n}★
                </Button>
              ))}
            </div>
            <Button className="mt-3" variant="secondary" onClick={() => void api(`/reports/${id}/reopen`, { method: 'POST', body: JSON.stringify({ note: 'Issue persists' }) })}>
              Reopen / dispute
            </Button>
          </GlassCard>
        )}
      </div>
      <div className="h-80 overflow-hidden rounded-2xl">
        <MapContainer center={[r.lat, r.lng]} zoom={16} className="h-full w-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[r.lat, r.lng]} />
        </MapContainer>
      </div>
    </div>
  )
}
