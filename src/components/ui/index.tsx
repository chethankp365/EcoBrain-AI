import { motion, useMotionValue, useSpring } from 'framer-motion'
import { AlertCircle, Check, Leaf } from 'lucide-react'
import { createContext, useContext, useEffect, useMemo, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

const ease = [0.76, 0, 0.24, 1] as const

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-white font-semibold text-lg tracking-tight ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#6EE7A8] to-[#B6F36B] text-black">
        <Leaf className="h-4 w-4" />
      </span>
      EcoBrain AI
    </span>
  )
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'icon' }) {
  const styles = {
    primary: 'bg-white text-black hover:bg-white/90',
    secondary: 'bg-transparent border border-white/40 text-white hover:bg-white/10 hover:border-white/60',
    ghost: 'bg-transparent text-white/80 hover:text-white hover:bg-white/5',
    icon: 'bg-white/5 border border-white/10 text-white h-11 w-11 p-0 grid place-items-center',
  }[variant]
  return (
    <button
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-7 py-3 text-sm font-medium transition-all duration-300 ease-cinematic disabled:opacity-40 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function GlassCard({ children, className = '', onMouseMove, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      onMouseMove={onMouseMove}
      className={`glass shadow-glow ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'low' | 'medium' | 'high' | 'urgent' | 'sim' | 'est' | 'ai'
}) {
  const map: Record<string, string> = {
    neutral: 'bg-white/10 text-white/80',
    success: 'bg-emerald-400/15 text-emerald-200',
    low: 'bg-slate-400/20 text-slate-200',
    medium: 'bg-amber-400/20 text-amber-100',
    high: 'bg-orange-500/20 text-orange-100',
    urgent: 'bg-red-500/20 text-red-100',
    sim: 'bg-white/10 text-white/70 tracking-wider',
    est: 'bg-lime-400/10 text-[#B6F36B]',
    ai: 'bg-emerald-400/10 text-[#6EE7A8]',
  }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium uppercase ${map[tone]}`}>{children}</span>
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-[44px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 ${props.className || ''}`}
    />
  )
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 ${props.className || ''}`}
    />
  )
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`min-h-[44px] w-full rounded-2xl border border-white/10 bg-[#0B0F0E] px-4 text-sm text-white ${props.className || ''}`}
    />
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="flex min-h-[44px] items-center gap-3">
      <span className={`h-6 w-11 rounded-full p-0.5 transition ${checked ? 'bg-[#6EE7A8]' : 'bg-white/20'}`}>
        <span className={`block h-5 w-5 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} />
      </span>
      <span className="text-sm text-white/70">{label}</span>
    </button>
  )
}

const ToastCtx = createContext<(m: string) => void>(() => {})
export function useToast() {
  return useContext(ToastCtx)
}
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 3200)
    return () => clearTimeout(t)
  }, [msg])
  return (
    <ToastCtx.Provider value={setMsg}>
      {children}
      {msg && (
        <div className="fixed bottom-6 right-6 z-[80] glass px-4 py-3 text-sm text-white/90">{msg}</div>
      )}
    </ToastCtx.Provider>
  )
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal>
      <GlassCard className="w-full max-w-lg p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-instrument-serif text-2xl">{title}</h2>
          <Button variant="icon" onClick={onClose} aria-label="Close">
            ×
          </Button>
        </div>
        {children}
      </GlassCard>
    </div>
  )
}

export function Drawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <div className={`fixed inset-0 z-[60] ${open ? '' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/50 transition ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <aside className={`absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto glass p-6 transition-transform duration-500 ease-cinematic ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {children}
      </aside>
    </div>
  )
}

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`min-h-[44px] rounded-full px-4 text-sm ${value === t.id ? 'bg-white text-black' : 'border border-white/20 text-white/70'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-black/90 px-2 py-1 text-[11px] text-white group-hover:block">
        {label}
      </span>
    </span>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/10 ${className}`} />
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <GlassCard className="p-10 text-center">
      <AlertCircle className="mx-auto mb-3 text-white/40" />
      <h3 className="font-instrument-serif text-2xl">{title}</h3>
      <p className="mt-2 text-sm text-white/60">{body}</p>
    </GlassCard>
  )
}

export function StatCard({ label, value, badge }: { label: string; value: number | string; badge?: string }) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between text-xs text-white/50">
        {label}
        {badge && <Badge tone="sim">{badge}</Badge>}
      </div>
      <div className="mt-2 font-instrument-serif text-4xl">{value}</div>
    </GlassCard>
  )
}

export function ProgressRing({ value, size = 64 }: { value: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * Math.min(1, Math.max(0, value))
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.1)" strokeWidth="6" fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#6EE7A8" strokeWidth="6" fill="none" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
    </svg>
  )
}

export function Timeline({ items }: { items: { title: string; meta: string; note?: string }[] }) {
  return (
    <ol className="space-y-4 border-l border-white/10 pl-4">
      {items.map((it, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[#6EE7A8]" />
          <p className="text-sm text-white/90">{it.title}</p>
          <p className="text-xs text-white/40">{it.meta}</p>
          {it.note && <p className="text-xs text-white/60">{it.note}</p>}
        </li>
      ))}
    </ol>
  )
}

export function DataTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-white/40">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-white/5">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 text-white/80">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ErrorBoundary({ children }: { children: ReactNode }) {
  return <Catcher>{children}</Catcher>
}
function Catcher({ children }: { children: ReactNode }) {
  const [err, setErr] = useState<Error | null>(null)
  if (err) {
    return (
      <div className="p-10">
        <EmptyState title="Something broke" body={err.message} />
      </div>
    )
  }
  return (
    <ErrorSink onError={setErr} reset={() => setErr(null)}>
      {children}
    </ErrorSink>
  )
}
function ErrorSink({ children }: { children: ReactNode; onError: (e: Error) => void; reset: () => void }) {
  return <>{children}</>
}

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
      {children}
    </motion.div>
  )
}

export function Magnetic({ children }: { children: ReactNode }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 200, damping: 20 })
  const sy = useSpring(y, { stiffness: 200, damping: 20 })
  return (
    <motion.div
      style={{ x: sx, y: sy }}
      onMouseMove={(event: React.MouseEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect()
        x.set((event.clientX - rect.left - rect.width / 2) / 8)
        y.set((event.clientY - rect.top - rect.height / 2) / 8)
      }}
      onMouseLeave={() => {
        x.set(0)
        y.set(0)
      }}
    >
      {children}
    </motion.div>
  )
}

export function SuccessCheck() {
  return (
    <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#6EE7A8] text-black">
      <Check size={36} />
    </motion.div>
  )
}

export const motionEase = ease

export function useCursorGlow() {
  return useMemo(() => ({ x: 0, y: 0 }), [])
}
