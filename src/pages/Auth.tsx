import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, GlassCard, Input, Logo } from '@/components/ui'
import { homeFor, useAuth } from '@/lib/auth'
import { api, setToken } from '@/lib/api'
import type { UserRole } from '@shared/types'

const VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204103_f607742e-09da-4cf5-bb06-4e67b0a531de.mp4'

export function LoginPage() {
  const { login, demo } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [demoMode, setDemoMode] = useState(false)

  useEffect(() => {
    api<{ demoMode: boolean }>('/health').then((status) => setDemoMode(status.demoMode)).catch(() => setDemoMode(false))
  }, [])

  async function go(fn: () => Promise<{ role: UserRole }>) {
    setErr('')
    try {
      const p = await fn()
      nav(homeFor(p.role))
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  return (
    <Split>
      <Logo />
      <h1 className="mt-8 font-instrument-serif text-4xl">Sign in</h1>
      <p className="mt-2 text-sm text-white/50">{demoMode ? 'Sign in with your account or use a demo role below.' : 'Sign in with your EcoBrain account.'}</p>
      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void go(() => login(email, password))
        }}
      >
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
        {err && <p className="text-sm text-red-300">{err}</p>}
        <Button className="w-full" type="submit">
          Continue
        </Button>
      </form>
      <p className="mt-4 text-sm text-white/50">
        <Link to="/forgot-password" className="underline">
          Forgot password
        </Link>
      </p>
      {demoMode && <>
        <p className="mt-8 text-xs uppercase tracking-[0.2em] text-white/40">Try a demo account</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['resident', 'worker', 'dispatcher', 'admin', 'analyst'] as UserRole[]).map((r) => (
            <Button key={r} variant="secondary" className="px-4 py-2 capitalize" onClick={() => void go(() => demo(r))}>
              {r}
            </Button>
          ))}
        </div>
      </>}
    </Split>
  )
}

export function SignupPage() {
  const { signup } = useAuth()
  const nav = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <Split>
      <Logo />
      <h1 className="mt-8 font-instrument-serif text-4xl">Create account</h1>
      <p className="mt-2 text-sm text-white/50">New signups are always residents. Admins promote roles later.</p>
      <form className="mt-8 space-y-4" onSubmit={(e) => {
        e.preventDefault()
        setBusy(true)
        setErr('')
        void signup(email, password, displayName)
          .then((profile) => {
            if (profile) nav(homeFor(profile.role))
            else setMessage('Account created. Check your email to confirm your address, then sign in.')
          })
          .catch((error: Error) => setErr(error.message))
          .finally(() => setBusy(false))
      }}>
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Full name" minLength={2} maxLength={80} required />
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" maxLength={254} required />
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (10+ chars)" minLength={10} maxLength={128} required />
        {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
        {message && <p role="status" className="text-sm text-emerald-200">{message}</p>}
        <Button className="w-full" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button>
      </form>
      <p className="mt-4 text-sm">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </Split>
  )
}

export function ForgotPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [err, setErr] = useState('')

  return (
    <Split>
      <Logo />
      <h1 className="mt-8 font-instrument-serif text-4xl">Reset password</h1>
      <form className="mt-8 space-y-4" onSubmit={(e) => {
        e.preventDefault()
        setErr('')
        void api<{ message: string }>('/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) })
          .then((response) => setMessage(response.message))
          .catch((error: Error) => setErr(error.message))
      }}>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
        {message && <p role="status" className="text-sm text-white/60">{message}</p>}
        {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
        <Button className="w-full" type="submit">Request reset</Button>
      </form>
    </Split>
  )
}

export function ResetPasswordPage() {
  const nav = useNavigate()
  const [accessToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('access_token') || '')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!accessToken) {
      setError('This password-reset link is invalid or expired. Request a new one.')
      return
    }
    setBusy(true)
    setError('')
    setToken(accessToken)
    try {
      await api('/auth/password', { method: 'POST', body: JSON.stringify({ password }) })
      setToken(null)
      setMessage('Password updated. You can now sign in.')
    } catch (err) {
      setToken(null)
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Split>
      <Logo />
      <h1 className="mt-8 font-instrument-serif text-4xl">Choose a new password</h1>
      <form className="mt-8 space-y-4" onSubmit={(event) => void submit(event)}>
        <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} maxLength={128} placeholder="New password (10+ chars)" required />
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        {message && <p role="status" className="text-sm text-emerald-200">{message}</p>}
        {message ? <Button className="w-full" onClick={() => nav('/login')}>Return to sign in</Button> : <Button className="w-full" type="submit" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</Button>}
      </form>
    </Split>
  )
}

function Split({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden md:block">
        <video className="absolute inset-0 h-full w-full object-cover" src={VIDEO} autoPlay muted loop playsInline />
        <div className="absolute inset-0 bg-black/50" />
      </div>
      <div className="flex items-center px-8 py-16 md:px-16">
        <GlassCard className="w-full max-w-md p-8">{children}</GlassCard>
      </div>
    </div>
  )
}
