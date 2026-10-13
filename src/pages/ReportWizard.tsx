import { CATEGORIES, type Category } from '@shared/types'
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet'
import type { DragEndEvent, Marker as LeafletMarker, LeafletMouseEvent } from 'leaflet'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, GlassCard, Input, ProgressRing, SuccessCheck, Textarea, useToast } from '@/components/ui'
import { api } from '@/lib/api'
import 'leaflet/dist/leaflet.css'

const CAT_LABEL: Record<Category, string> = {
  overflowing_bin: 'Overflowing bin',
  missed_collection: 'Missed collection',
  litter_hotspot: 'Litter hotspot',
  illegal_dumping: 'Illegal dumping',
  recyclable_material: 'Recyclable material',
  other: 'Other',
}

export default function ReportWizard() {
  const toast = useToast()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [category, setCategory] = useState<Category>('overflowing_bin')
  const [description, setDescription] = useState('')
  const [lat, setLat] = useState(12.9716)
  const [lng, setLng] = useState(77.5946)
  const [address, setAddress] = useState('MG Road, Bengaluru')
  const [photo, setPhoto] = useState<string>()
  const [privacy, setPrivacy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ code: string; id: string } | null>(null)
  const [dups, setDups] = useState<any[] | null>(null)
  const [ai, setAi] = useState<any>(null)

  useEffect(() => {
    const raw = localStorage.getItem('ecobrain_draft')
    if (raw) {
      const d = JSON.parse(raw)
      setCategory(d.category ?? 'overflowing_bin')
      setDescription(d.description ?? '')
    }
  }, [])
  useEffect(() => {
    localStorage.setItem('ecobrain_draft', JSON.stringify({ category, description, lat, lng }))
  }, [category, description, lat, lng])

  function speech() {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    if (!SR) {
      toast('Voice input is not available in this browser')
      return
    }
    const rec = new SR()
    rec.onresult = (e: any) => setDescription((d) => `${d} ${e.results[0][0].transcript}`.trim())
    rec.start()
  }

  async function locate() {
    toast('We use your location only to place the report pin inside the service area.')
    navigator.geolocation.getCurrentPosition((p) => {
      setLat(p.coords.latitude)
      setLng(p.coords.longitude)
    })
  }

  async function submit(submitAnyway = false, linkTo?: string) {
    setBusy(true)
    try {
      const res = await api<any>('/reports', {
        method: 'POST',
        body: JSON.stringify({ category, description, lat, lng, address, photo, submitAnyway, linkTo }),
      })
      if (res.possibleDuplicates) {
        setDups(res.possibleDuplicates)
        setBusy(false)
        return
      }
      const cls = await api<any>(`/reports/${res.report.id}/classify`, { method: 'POST', body: '{}' })
      setAi(cls)
      setDone({ code: res.report.code, id: res.report.id })
      localStorage.removeItem('ecobrain_draft')
    } catch (e) {
      const response = e as Error & { body?: { possibleDuplicates?: any[] } }
      if (response.body?.possibleDuplicates) {
        setDups(response.body.possibleDuplicates)
        return
      }
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <GlassCard className="mx-auto max-w-lg p-10 text-center">
        <SuccessCheck />
        <h1 className="mt-6 font-instrument-serif text-4xl">{done.code}</h1>
        {ai && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <ProgressRing value={ai.confidence} />
            <div className="text-left text-sm">
              <Badge tone="ai">AI SUGGESTION</Badge>
              <p className="mt-1">{ai.label.replaceAll('_', ' ')}</p>
              <p className="text-white/40">{ai.modelVersion} · {(ai.confidence * 100).toFixed(0)}%</p>
              {ai.confidence < 0.65 && <p className="text-amber-200">Needs review</p>}
            </div>
          </div>
        )}
        <Button className="mt-6" onClick={() => nav(`/my-reports/${done.id}`)}>
          Track status
        </Button>
      </GlassCard>
    )
  }

  const steps = ['Category', 'Details', 'Location', 'Photo', 'Review']

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 h-1 rounded-full bg-white/10">
        <div className="h-1 rounded-full bg-[#6EE7A8]" style={{ width: `${((step + 1) / 5) * 100}%` }} />
      </div>
      <p className="text-xs uppercase tracking-[0.2em] text-white/40">
        Step {step + 1} · {steps[step]}
      </p>

      {step === 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`min-h-[88px] rounded-2xl border p-4 text-left ${category === c ? 'border-[#6EE7A8] bg-white/10' : 'border-white/10 bg-white/5'}`}
            >
              {CAT_LABEL[c]}
            </button>
          ))}
        </div>
      )}
      {step === 1 && (
        <div className="mt-6 space-y-3">
          <Textarea rows={6} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what you see" />
          <div className="flex items-center justify-between text-xs text-white/40">
            <button type="button" onClick={speech} className="underline">
              Voice input
            </button>
            {description.length}/2000
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="mt-6 space-y-3">
          <div className="h-72 overflow-hidden rounded-2xl">
            <MapContainer center={[lat, lng]} zoom={15} className="h-full w-full" scrollWheelZoom>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
              <Pin lat={lat} lng={lng} onChange={(a, b) => { setLat(a); setLng(b) }} />
            </MapContainer>
          </div>
          <Button variant="secondary" onClick={() => void locate()}>
            Use my location
          </Button>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address search (Nominatim)" />
        </div>
      )}
      {step === 3 && (
        <div className="mt-6">
          <label className="grid min-h-[160px] place-items-center rounded-2xl border border-dashed border-white/20 text-sm text-white/50">
            {photo ? 'Photo attached · location metadata removed' : 'Tap to capture or drop a photo'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return toast('Choose a JPEG, PNG, or WebP image')
                if (file.size > 8_000_000) return toast('Image is too large')
                void preparePhoto(file).then(setPhoto).catch(() => toast('This image could not be safely processed'))
              }}
            />
          </label>
        </div>
      )}
      {step === 4 && (
        <GlassCard className="mt-6 space-y-3 p-6">
          <p>{CAT_LABEL[category]}</p>
          <p className="text-white/60">{description}</p>
          <p className="text-xs text-white/40">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </p>
          <label className="flex items-start gap-3 text-sm text-white/70">
            <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="mt-1" />
            I understand location, description and optional photo are stored to dispatch collection crews.
          </label>
          {dups && (
            <div className="rounded-2xl border border-amber-400/30 p-4">
              <p className="text-sm">Similar report nearby</p>
              {dups.map((d) => (
                <div key={d.reportId} className="mt-2 text-xs text-white/60">
                  {d.reportCode} · {Math.round(d.distanceM)}m · {d.status}
                  <div className="mt-2 flex gap-2">
                    <Button className="px-3 py-2" onClick={() => void submit(false, d.reportId)}>
                      Add my voice to it
                    </Button>
                    <Button variant="secondary" className="px-3 py-2" onClick={() => void submit(true)}>
                      Submit anyway
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      <div className="mt-6 flex gap-3">
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        )}
        {step < 4 && (
          <Button onClick={() => setStep((s) => s + 1)} disabled={step === 1 && description.length < 8}>
            Continue
          </Button>
        )}
        {step === 4 && (
          <Button onClick={() => void submit()} disabled={!privacy || busy}>
            {busy ? 'Submitting…' : 'Submit report'}
          </Button>
        )}
      </div>
    </div>
  )
}

function Pin({ lat, lng, onChange }: { lat: number; lng: number; onChange: (a: number, b: number) => void }) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      onChange(event.latlng.lat, event.latlng.lng)
    },
  })
  return <Marker position={[lat, lng]} draggable eventHandlers={{ dragend: (event: DragEndEvent) => {
    const point = (event.target as LeafletMarker).getLatLng()
    onChange(point.lat, point.lng)
  } }} />
}

async function preparePhoto(file: File) {
  const image = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Image encoding failed')), 'image/jpeg', 0.84)
    })
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Image read failed'))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } finally {
    image.close()
  }
}
