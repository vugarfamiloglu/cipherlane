import type {
  Overview, Site, Tunnel, User, Session, Resource, Policy,
  Gateway, CloudConnector, Certificate, KeyItem, Alert, AuditEvent,
} from './types'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch('/api' + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  let body: { ok?: boolean; data?: unknown; error?: string } | null = null
  try {
    body = await res.json()
  } catch {
    /* non-JSON response */
  }
  if (!res.ok || !body || body.ok === false) {
    throw new ApiError(body?.error || res.statusText || 'Request failed', res.status)
  }
  return body.data as T
}

export const api = {
  me: () => req<{ authenticated: boolean }>('/auth/me'),
  login: (passcode: string) =>
    req<{ authenticated: boolean }>('/auth/login', { method: 'POST', body: JSON.stringify({ passcode }) }),
  logout: () => req<{ authenticated: boolean }>('/auth/logout', { method: 'POST' }),

  overview: () => req<Overview>('/overview'),
  sites: () => req<Site[]>('/sites'),
  site: (id: string) => req<{ site: Site; tunnels: Tunnel[]; resources: Resource[] }>(`/sites/${id}`),
  tunnels: () => req<Tunnel[]>('/tunnels'),
  tunnel: (id: string) => req<Tunnel>(`/tunnels/${id}`),
  users: () => req<User[]>('/users'),
  user: (id: string) => req<User>(`/users/${id}`),
  sessions: () => req<Session[]>('/sessions'),
  resources: () => req<Resource[]>('/resources'),
  policies: () => req<Policy[]>('/policies'),
  gateways: () => req<Gateway[]>('/gateways'),
  cloud: () => req<CloudConnector[]>('/cloud'),
  certificates: () => req<Certificate[]>('/certificates'),
  keys: () => req<KeyItem[]>('/keys'),
  alerts: () => req<Alert[]>('/alerts'),
  audit: () => req<AuditEvent[]>('/audit'),
}
