const TOKEN_KEY = 'ecobrain_token'
const REFRESH_KEY = 'ecobrain_refresh_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY)
}
export function setToken(t: string | null) {
  if (t) {
    localStorage.setItem(TOKEN_KEY, t)
  } else {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
  }
}
export function setSession(accessToken: string, refreshToken?: string) {
  localStorage.setItem(TOKEN_KEY, accessToken)
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
  else localStorage.removeItem(REFRESH_KEY)
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const request = async (token: string | null) => {
    const headers = new Headers(init.headers)
    if (!(init.body instanceof FormData) && !headers.has('Content-Type') && init.body) {
      headers.set('Content-Type', 'application/json')
    }
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(`/api${path}`, { ...init, headers })
  }

  let res = await request(getToken())
  if (res.status === 401 && path !== '/auth/refresh' && getRefreshToken()) {
    const refreshResponse = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: getRefreshToken() }),
    })
    if (refreshResponse.ok) {
      const session = (await refreshResponse.json()) as { token: string; refreshToken: string }
      setSession(session.token, session.refreshToken)
      res = await request(session.token)
    } else {
      setToken(null)
    }
  }

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = json?.error || { code: 'http', message: res.statusText }
    throw Object.assign(new Error(err.message), { status: res.status, body: json })
  }
  return json as T
}
