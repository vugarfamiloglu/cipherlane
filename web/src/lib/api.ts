import type {
  Overview, Site, Tunnel, User, Session, Resource, Policy, Device,
  Gateway, CloudConnector, Certificate, KeyItem, Alert, AuditEvent, Operator,
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
  me: () => req<{ authenticated: boolean; role?: string; name?: string }>('/auth/me'),
  login: (creds: Record<string, string>) =>
    req<{ authenticated: boolean; role?: string; name?: string }>('/auth/login', { method: 'POST', body: JSON.stringify(creds) }),
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

  createSite: (b: Record<string, unknown>) => req<Site>('/sites', { method: 'POST', body: JSON.stringify(b) }),
  createTunnel: (b: Record<string, unknown>) => req<Tunnel>('/tunnels', { method: 'POST', body: JSON.stringify(b) }),
  createPolicy: (b: Record<string, unknown>) => req<{ id: string }>('/policies', { method: 'POST', body: JSON.stringify(b) }),

  mfaStatus: () => req<{ enabled: boolean }>('/auth/mfa'),
  mfaSetup: () => req<{ secret: string; otpauthUri: string }>('/auth/mfa/setup', { method: 'POST' }),
  mfaActivate: (code: string) => req<{ enabled: boolean }>('/auth/mfa/activate', { method: 'POST', body: JSON.stringify({ code }) }),
  mfaDisable: (code: string) => req<{ enabled: boolean }>('/auth/mfa/disable', { method: 'POST', body: JSON.stringify({ code }) }),
  agentToken: () => req<{ token: string }>('/agent/token'),

  changePasscode: (current: string, next: string) =>
    req<{ changed: boolean }>('/auth/passcode', { method: 'POST', body: JSON.stringify({ current, next }) }),
  resetEstate: () => req<{ reset: boolean }>('/reset', { method: 'POST' }),

  updateSite: (id: string, b: Record<string, unknown>) => req(`/sites/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deleteSite: (id: string) => req(`/sites/${id}`, { method: 'DELETE' }),
  updateTunnel: (id: string, b: Record<string, unknown>) => req(`/tunnels/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deleteTunnel: (id: string) => req(`/tunnels/${id}`, { method: 'DELETE' }),
  toggleTunnel: (id: string) => req<{ status: string }>(`/tunnels/${id}/toggle`, { method: 'POST' }),
  createGateway: (b: Record<string, unknown>) => req<{ id: string }>('/gateways', { method: 'POST', body: JSON.stringify(b) }),
  updateGateway: (id: string, b: Record<string, unknown>) => req(`/gateways/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deleteGateway: (id: string) => req(`/gateways/${id}`, { method: 'DELETE' }),
  rotateGateway: (id: string) => req<{ publicKey: string }>(`/gateways/${id}/rotate`, { method: 'POST' }),
  createCloud: (b: Record<string, unknown>) => req<{ id: string }>('/cloud', { method: 'POST', body: JSON.stringify(b) }),
  deleteCloud: (id: string) => req(`/cloud/${id}`, { method: 'DELETE' }),

  createUser: (b: Record<string, unknown>) => req<{ id: string }>('/users', { method: 'POST', body: JSON.stringify(b) }),
  updateUser: (id: string, b: Record<string, unknown>) => req(`/users/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deleteUser: (id: string) => req(`/users/${id}`, { method: 'DELETE' }),
  suspendUser: (id: string) => req<{ status: string }>(`/users/${id}/suspend`, { method: 'POST' }),
  enrollDevice: (id: string, b: Record<string, unknown>) =>
    req<{ device: Device; config: string; publicKey: string }>(`/users/${id}/devices`, { method: 'POST', body: JSON.stringify(b) }),
  deleteDevice: (id: string) => req(`/devices/${id}`, { method: 'DELETE' }),
  disconnectSession: (id: string) => req(`/sessions/${id}/disconnect`, { method: 'POST' }),
  createResource: (b: Record<string, unknown>) => req<{ id: string }>('/resources', { method: 'POST', body: JSON.stringify(b) }),
  updateResource: (id: string, b: Record<string, unknown>) => req(`/resources/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deleteResource: (id: string) => req(`/resources/${id}`, { method: 'DELETE' }),
  updatePolicy: (id: string, b: Record<string, unknown>) => req(`/policies/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deletePolicy: (id: string) => req(`/policies/${id}`, { method: 'DELETE' }),

  resolveAlert: (id: string) => req(`/alerts/${id}/resolve`, { method: 'POST' }),
  issueCert: (b: Record<string, unknown>) => req<{ id: string; fingerprint: string; certPem: string }>('/certificates', { method: 'POST', body: JSON.stringify(b) }),
  revokeCert: (id: string) => req(`/certificates/${id}/revoke`, { method: 'POST' }),
  deleteCert: (id: string) => req(`/certificates/${id}`, { method: 'DELETE' }),
  generateKey: (b: Record<string, unknown>) => req<{ id: string; publicMaterial: string }>('/keys', { method: 'POST', body: JSON.stringify(b) }),
  revealKey: (id: string) => req<{ secret: string }>(`/keys/${id}/reveal`, { method: 'POST' }),
  deleteKey: (id: string) => req(`/keys/${id}`, { method: 'DELETE' }),

  operators: () => req<Operator[]>('/operators'),
  createOperator: (b: Record<string, unknown>) => req<{ id: string }>('/operators', { method: 'POST', body: JSON.stringify(b) }),
  updateOperator: (id: string, b: Record<string, unknown>) => req(`/operators/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deleteOperator: (id: string) => req(`/operators/${id}`, { method: 'DELETE' }),
  getWebhook: () => req<{ url: string }>('/webhook'),
  setWebhook: (url: string) => req<{ url: string }>('/webhook', { method: 'PUT', body: JSON.stringify({ url }) }),
}


