import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMutation, useQuery } from '@tanstack/react-query'
import { MapContainer, Polyline, TileLayer, CircleMarker } from 'react-leaflet'
import { useState } from 'react'
import { Badge, Button, GlassCard, StatCard } from '@/components/ui'
import { api } from '@/lib/api'
import type { RouteMetrics } from '@shared/types'

type PlannedStop = { id: string; vehicleId: string; sequence: number; report?: { lat: number; lng: number; address: string } }
type OptimiseResponse = { plan: { id: string } }
type RouteDetail = {
  plan: { id: string; status: string; metrics: { optimised: RouteMetrics; nearestNeighbour: RouteMetrics; original: RouteMetrics } }
  stops: PlannedStop[]
  depot?: { lat: number; lng: number }
}

export default function RoutesPage() {
  const [planId, setPlanId] = useState<string>()
  const optimise = useMutation({
    mutationFn: () =>
      api<any>('/routes/optimise', {
        method: 'POST',
        body: JSON.stringify({
          date: new Date().toISOString().slice(0, 10),
          shiftStart: '07:00',
          shiftEnd: '15:00',
          serviceAreaId: 'area_greenfield',
          vehicleIds: ['veh_1', 'veh_2'],
        }),
      }),
    onSuccess: (response: OptimiseResponse) => setPlanId(response.plan.id),
  })
  const { data } = useQuery({
    queryKey: ['plan', planId],
    queryFn: () => api<RouteDetail>(`/routes/${planId}`),
    enabled: Boolean(planId),
  })
  const [order, setOrder] = useState<string[]>([])
  const stops: PlannedStop[] = data?.stops ?? []
  const ids: string[] = order.length ? order : stops.map((stop) => stop.id)

  function onDrag(e: DragEndEvent) {
    if (!e.over) return
    const old = ids.indexOf(String(e.active.id))
    const neu = ids.indexOf(String(e.over.id))
    setOrder(arrayMove(ids, old, neu))
  }

  const m = data?.plan?.metrics
  const colors = ['#6EE7A8', '#60a5fa']

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-instrument-serif text-4xl">Route plans</h1>
          <p className="text-sm text-amber-200">Recommendation, not a guarantee.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => optimise.mutate()}>{optimise.isPending ? 'Solving…' : 'Plan shift · 2 vehicles'}</Button>
          {planId && (
            <Button variant="secondary" onClick={() => void api(`/routes/${planId}/approve`, { method: 'POST' })}>
              Approve
            </Button>
          )}
        </div>
      </div>
      {m && (
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {(['optimised', 'nearestNeighbour', 'original'] as const).map((k) => (
            <StatCard key={k} label={k} value={`${m[k].distanceKm} km · ${m[k].timeMin} min`} badge="Estimated from routing data; real traffic may differ" />
          ))}
        </div>
      )}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="h-[520px] overflow-hidden rounded-2xl">
          <MapContainer center={[12.9716, 77.5946]} zoom={14} className="h-full w-full">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {Array.from(new Set(stops.map((stop) => stop.vehicleId))).map((vehicleId, vi) => {
              const pts = stops
                .filter((stop) => stop.vehicleId === vehicleId && stop.report)
                .sort((a, b) => a.sequence - b.sequence)
              const depot = data?.depot
              const positions: [number, number][] = [
                ...(depot ? [[depot.lat, depot.lng] as [number, number]] : []),
                ...pts.map((stop) => [stop.report!.lat, stop.report!.lng] as [number, number]),
                ...(depot && pts.length ? [[depot.lat, depot.lng] as [number, number]] : []),
              ]
              return (
                <Polyline key={vehicleId} positions={positions} pathOptions={{ color: colors[vi % colors.length] }} />
              )
            })}
            {stops.filter((stop) => stop.report).map((stop) => (
              <CircleMarker key={stop.id} center={[stop.report!.lat, stop.report!.lng]} radius={6} />
            ))}
          </MapContainer>
        </div>
        <GlassCard className="p-4">
          <Badge tone="est">ESTIMATE</Badge>
          <DndContext collisionDetection={closestCenter} onDragEnd={onDrag}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {ids.map((id: string) => {
                    const s = stops.find((stop) => stop.id === id)
                if (!s) return null
                return <SortRow key={id} id={id} label={`Stop ${s.sequence} · ${s.vehicleId}`} />
              })}
            </SortableContext>
          </DndContext>
        </GlassCard>
      </div>
    </div>
  )
}

function SortRow({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, resizeObserverConfig: { disabled: false } })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners} className="mt-2 min-h-[44px] rounded-xl border border-white/10 px-3 py-2 text-sm">
      {label}
    </div>
  )
}
