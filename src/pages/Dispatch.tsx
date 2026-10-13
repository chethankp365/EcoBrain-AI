import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MapContainer, Marker, Polygon, TileLayer } from 'react-leaflet'
import { useState } from 'react'
import { Badge, Button, Drawer, GlassCard, Input, ProgressRing } from '@/components/ui'
import { api } from '@/lib/api'
import type { PriorityLabel } from '@shared/types'

type DispatchReport = {
  id: string
  code: string
  category: string
  description: string
  lat: number
  lng: number
  priorityLabel: PriorityLabel
  status: string
}

export default function Dispatch() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['q'], queryFn: () => api<{ data: DispatchReport[] }>('/reports?limit=50') })
  const { data: workers } = useQuery({ queryKey: ['w'], queryFn: () => api<any[]>('/lookups/workers') })
  const [sel, setSel] = useState<any>(null)
  const [detail, setDetail] = useState<any>(null)

  const assign = useMutation({
    mutationFn: () =>
      api('/assignments', {
        method: 'POST',
        body: JSON.stringify({
          reportId: sel.id,
          workerId: workers?.[0]?.id || 'user_worker',
          vehicleId: 'veh_1',
          dueAt: new Date(Date.now() + 864e5).toISOString(),
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['q'] }),
  })

  const open = data?.data.filter((report: DispatchReport) => !['completed', 'rejected_duplicate'].includes(report.status)) ?? []

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_1fr_360px]">
      <GlassCard className="max-h-[80vh] overflow-auto p-3">
        <Input placeholder="Filter queue" />
        <div className="mt-3 space-y-2">
          {open.map((r: DispatchReport) => (
            <button
              key={r.id}
              onClick={() => {
                setSel(r)
                void api(`/reports/${r.id}`).then(setDetail)
              }}
              className={`w-full rounded-2xl border p-3 text-left ${sel?.id === r.id ? 'border-[#6EE7A8]' : 'border-white/10'}`}
            >
              <div className="flex justify-between text-xs">
                {r.code} <Badge tone={r.priorityLabel}>{r.priorityLabel}</Badge>
              </div>
              <p className="text-sm">{r.category.replaceAll('_', ' ')}</p>
              {r.status === 'needs_review' && <Badge tone="ai">Needs review</Badge>}
            </button>
          ))}
        </div>
      </GlassCard>
      <div className="h-[70vh] overflow-hidden rounded-2xl">
        <MapContainer center={[12.9716, 77.5946]} zoom={14} className="h-full w-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Polygon positions={[[12.955, 77.57], [12.99, 77.57], [12.99, 77.62], [12.955, 77.62]]} pathOptions={{ color: '#6EE7A8', fillOpacity: 0.08 }} />
          {open.map((r: DispatchReport) => (
            <Marker key={r.id} position={[r.lat, r.lng]} eventHandlers={{ click: () => setSel(r) }} />
          ))}
        </MapContainer>
      </div>
      <GlassCard className="p-5">
        {!sel && <p className="text-white/40">Select a report</p>}
        {sel && (
          <>
            <h2 className="font-instrument-serif text-2xl">{sel.code}</h2>
            <p className="text-sm text-white/60">{sel.description}</p>
            {detail?.classification && (
              <div className="mt-4 flex items-center gap-3">
                <ProgressRing value={detail.classification.confidence} size={56} />
                <div>
                  <Badge tone="ai">AI SUGGESTION</Badge>
                  <p>{detail.classification.label}</p>
                  <p className="text-xs text-white/40">{detail.classification.modelVersion}</p>
                  <div className="mt-2 flex gap-2">
                    <Button className="px-3 py-2" onClick={() => void api(`/reports/${sel.id}/review-ai`, { method: 'POST', body: JSON.stringify({ category: sel.category }) })}>
                      Confirm
                    </Button>
                    <Button variant="secondary" className="px-3 py-2">
                      Correct
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <Button className="mt-6 w-full" onClick={() => assign.mutate()} disabled={!sel}>
              Assign to {workers?.[0]?.displayName || 'worker'}
            </Button>
            <p className="mt-4 text-xs text-white/40">Exceptions: inaccessible / partial / reopened live in this queue.</p>
          </>
        )}
      </GlassCard>
      <Drawer open={false} onClose={() => {}}>
        {null}
      </Drawer>
    </div>
  )
}
