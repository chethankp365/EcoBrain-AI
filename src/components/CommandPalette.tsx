import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const PAGES = [
  ['Landing', '/'],
  ['Report', '/report'],
  ['My reports', '/my-reports'],
  ['Worker', '/worker'],
  ['Dispatch', '/dispatch'],
  ['Routes', '/routes'],
  ['Analytics', '/analytics'],
  ['Hotspots', '/hotspots'],
  ['Admin', '/admin'],
  ['Evaluation', '/evaluation'],
  ['Transparency', '/transparency'],
]

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const nav = useNavigate()
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
  if (!open) return null
  const items = PAGES.filter((p) => p[0].toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="fixed inset-0 z-[90] grid place-items-start bg-black/70 p-4 pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="glass w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
        <input autoFocus className="min-h-[44px] w-full bg-transparent text-lg outline-none" placeholder="Jump to…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="mt-2">
          {items.map(([label, to]) => (
            <li key={to}>
              <button
                className="w-full rounded-xl px-3 py-3 text-left hover:bg-white/10"
                onClick={() => {
                  nav(to)
                  setOpen(false)
                }}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
