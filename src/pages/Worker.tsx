import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigation } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge, Button, GlassCard, Textarea, useToast } from '@/components/ui'
import { api } from '@/lib/api'
import { get, set } from 'idb-keyval'

export default function WorkerHome() {
  const { data } = useQuery({ queryKey: ['wroute'], queryFn: () => api<any>('/worker/route') })
  const stops = data?.stops ?? []
  const next = stops.find((s: any) => s.outcome === 'pending') || stops[0]
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="font-instrument-serif text-4xl">Today</h1>
      {next ? (
        <GlassCard className="p-6">
          <p className="text-xs text-white/40">Next stop</p>
          <h2 className="mt-2 font-instrument-serif text-3xl">{next.report?.address || next.reportId}</h2>
          <div className="mt-2 flex gap-2">
            <Badge tone={next.report?.priorityLabel || 'medium'}>{next.report?.priorityLabel || 'queued'}</Badge>
            <Badge>{next.report?.category?.replaceAll('_', ' ')}</Badge>
          </div>
          <p className="mt-3 text-white/60">{next.report?.description}</p>
          <a
            className="mt-6 flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-white text-black"
            href={`https://www.google.com/maps/dir/?api=1&destination=${next.report?.lat},${next.report?.lng}`}
            target="_blank"
            rel="noreferrer"
          >
            <Navigation className="h-4 w-4" /> Navigate
          </a>
        </GlassCard>
      ) : (
        <p className="text-white/50">No approved route yet. Ask dispatch to plan a shift.</p>
      )}
      <div className="h-2 rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-[#6EE7A8]" style={{ width: `${stops.length ? (stops.filter((s: any) => s.outcome === 'completed').length / stops.length) * 100 : 0}%` }} />
      </div>
      <div className="space-y-2">
        {stops.map((s: any) => (
          <a key={s.id} href="/worker/route" className="block rounded-2xl border border-white/10 p-3 text-sm">
            {s.sequence}. {s.report?.address} · {s.outcome}
          </a>
        ))}
      </div>
    </div>
  )
}

export function WorkerRoute() {
  const toast = useToast()
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['wroute'], queryFn: () => api<any>('/worker/route') })
  const [note, setNote] = useState('')
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    if (!offline) void flushOutbox(qc)
  }, [offline, qc])

  const act = useMutation({
    mutationFn: async (payload: { id: string; outcome: string }) => {
      const body = { outcome: payload.outcome, note, idempotencyKey: crypto.randomUUID() }
      if (!navigator.onLine) {
        const box = ((await get('outbox')) as any[]) || []
        box.push({ path: `/route-stops/${payload.id}/complete`, body })
        await set('outbox', box)
        toast('Queued offline · Pending sync')
        return
      }
      return api(`/route-stops/${payload.id}/complete`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wroute'] }),
  })

  const stops = data?.stops ?? []
  return (
    <div className="mx-auto max-w-lg space-y-4">
      {offline && <Badge tone="sim">Pending sync</Badge>}
      {stops.map((s: any) => (
        <GlassCard key={s.id} className="p-5">
          <div className="flex justify-between">
            <span>Stop {s.sequence}</span>
            <Badge>{s.outcome}</Badge>
          </div>
          <p className="mt-2">{s.report?.address}</p>
          <Textarea className="mt-3" placeholder="Note required for inaccessible / partial / follow-up" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={() => act.mutate({ id: s.id, outcome: 'started' })}>Start</Button>
            <Button onClick={() => act.mutate({ id: s.id, outcome: 'completed' })}>Complete</Button>
            <Button variant="secondary" onClick={() => act.mutate({ id: s.id, outcome: 'partially_completed' })}>
              Partial
            </Button>
            <Button variant="secondary" onClick={() => act.mutate({ id: s.id, outcome: 'inaccessible' })}>
              Inaccessible
            </Button>
          </div>
        </GlassCard>
      ))}
    </div>
  )
}

async function flushOutbox(qc: ReturnType<typeof useQueryClient>) {
  const box = ((await get('outbox')) as any[]) || []
  for (const item of box) {
    await api(item.path, { method: 'POST', body: JSON.stringify(item.body) })
  }
  await set('outbox', [])
  void qc.invalidateQueries({ queryKey: ['wroute'] })
}
