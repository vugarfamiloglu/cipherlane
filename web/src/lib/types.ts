// TypeScript mirrors of the control-plane JSON DTOs (see server/internal/models).

export type Status = string

export interface Site {
  id: string; name: string; code: string; kind: string
  location: string; subnetCidr: string; status: Status
  createdAt: number; updatedAt: number
  gateways?: Gateway[]; tunnelCount: number
}

export interface Gateway {
  id: string; siteId: string; name: string; endpoint: string; wanIp: string
  protocol: string; version: string; status: Status
  lastSeen: number; createdAt: number; updatedAt: number; siteName?: string
}

export interface TunnelLive {
  status: Status; rxMbps: number; txMbps: number
  latencyMs: number; lossPct: number; handshakeAgeS: number; rekeyInS: number
  history?: number[]
}

export interface Route { id: string; tunnelId: string; cidr: string; kind: string }

export interface Tunnel {
  id: string; name: string
  aSiteId: string; bSiteId: string; aSiteName: string; bSiteName: string
  protocol: string; cipher: string; authMethod: string; routing: string
  alwaysOn: boolean; status: Status; mtu: number
  createdAt: number; updatedAt: number
  routes?: Route[]; live?: TunnelLive
}

export interface Device {
  id: string; userId: string; name: string; platform: string
  publicKey: string; lastHandshake: number; status: Status; createdAt: number
}

export interface Session {
  id: string; userId: string; userName: string; deviceId: string; deviceName: string
  clientIp: string; assignedIp: string; location: string; status: Status
  startedAt: number; rxMbps: number; txMbps: number
}

export interface User {
  id: string; name: string; email: string; username: string; role: string
  group: string; status: Status; tunnelMode: string; corporateIp: string
  mfaEnabled: boolean; createdAt: number; updatedAt: number
  devices?: Device[]; sessions?: Session[]
}

export interface Resource {
  id: string; name: string; kind: string; host: string; port: number
  siteId: string; siteName: string; createdAt: number
}

export interface Policy {
  id: string; name: string; group: string; resourceId: string
  resourceName: string; action: string; createdAt: number
}

export interface CloudConnector {
  id: string; siteId: string; siteName: string; provider: string
  region: string; vpcId: string; status: Status; createdAt: number
}

export interface Certificate {
  id: string; name: string; kind: string; subject: string
  fingerprint: string; status: Status; notAfter: number; createdAt: number
}

export interface KeyItem {
  id: string; name: string; kind: string; publicMaterial: string
  sealed: boolean; createdAt: number
}

export interface Alert {
  id: string; severity: string; title: string; detail: string
  source: string; status: string; createdAt: number
}

export interface AuditEvent {
  id: string; actor: string; action: string; target: string; ip: string; createdAt: number
}

export interface Operator {
  id: string; name: string; email: string; role: string; status: string
  createdAt: number; updatedAt: number
}

export interface GlobalLive { rx: number; tx: number; activeTunnels: number; onlineSessions: number }
export interface SeriesPoint { ts: number; rx: number; tx: number }

export interface Overview {
  counts: Record<string, number>
  live: GlobalLive
  series: SeriesPoint[]
  alerts: Alert[]
  audit: AuditEvent[]
}

export interface Telemetry {
  tunnels: Record<string, TunnelLive>
  sessions: Record<string, { rxMbps: number; txMbps: number; status: string }>
  global: GlobalLive
  series: SeriesPoint[]
}
