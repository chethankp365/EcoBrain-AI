const TOKEN_KEY = 'ecobrain_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (!(init.body instanceof FormData) && !headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`/api${path}`, { ...init, headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = json?.error || { code: 'http', message: res.statusText }
    throw Object.assign(new Error(err.message), { status: res.status, body: json })
  }
  return json as T
}
