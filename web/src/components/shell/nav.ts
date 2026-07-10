import type { IconName } from '../ui/Icon'

export interface NavItem { path: string; label: string; icon: IconName }
export interface NavGroup { label: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  {
    label: 'Operations',
    items: [
      { path: '/', label: 'Overview', icon: 'overview' },
      { path: '/topology', label: 'Topology', icon: 'topology' },
    ],
  },
  {
    label: 'Site-to-Site',
    items: [
      { path: '/sites', label: 'Sites', icon: 'sites' },
      { path: '/tunnels', label: 'Tunnels', icon: 'tunnels' },
      { path: '/gateways', label: 'Gateways', icon: 'gateways' },
      { path: '/cloud', label: 'Cloud', icon: 'cloud' },
    ],
  },
  {
    label: 'Remote Access',
    items: [
      { path: '/users', label: 'Users', icon: 'users' },
      { path: '/sessions', label: 'Sessions', icon: 'sessions' },
      { path: '/resources', label: 'Resources', icon: 'resources' },
    ],
  },
  {
    label: 'Security',
    items: [
      { path: '/vault', label: 'Vault', icon: 'vault' },
      { path: '/monitoring', label: 'Monitoring', icon: 'monitoring' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { path: '/analytics', label: 'Analytics', icon: 'analytics' },
      { path: '/settings', label: 'Settings', icon: 'settings' },
    ],
  },
]

interface Header { crumb: string; title: string; subtitle?: string }

const HEADERS: Record<string, Header> = {
  '/': { crumb: 'OPERATIONS', title: 'Control Overview', subtitle: 'Live estate posture' },
  '/topology': { crumb: 'OPERATIONS', title: 'Network Topology', subtitle: 'Sites, tunnels & peers' },
  '/sites': { crumb: 'SITE-TO-SITE', title: 'Sites', subtitle: 'Locations & subnets' },
  '/tunnels': { crumb: 'SITE-TO-SITE', title: 'Tunnels', subtitle: 'Encrypted site links' },
  '/gateways': { crumb: 'SITE-TO-SITE', title: 'Gateways', subtitle: 'Tunnel endpoints' },
  '/cloud': { crumb: 'SITE-TO-SITE', title: 'Cloud Connectors', subtitle: 'AWS · Azure · GCP' },
  '/users': { crumb: 'REMOTE ACCESS', title: 'Users', subtitle: 'Remote-access accounts' },
  '/sessions': { crumb: 'REMOTE ACCESS', title: 'Sessions', subtitle: 'Live connections' },
  '/resources': { crumb: 'REMOTE ACCESS', title: 'Resources & Policies', subtitle: 'Access control' },
  '/vault': { crumb: 'SECURITY', title: 'Vault', subtitle: 'Certificates & keys' },
  '/monitoring': { crumb: 'SECURITY', title: 'Monitoring', subtitle: 'Alerts & audit trail' },
  '/analytics': { crumb: 'INSIGHTS', title: 'Analytics', subtitle: 'Traffic & uptime' },
  '/settings': { crumb: 'INSIGHTS', title: 'Settings', subtitle: 'Console configuration' },
}

export function deriveHeader(pathname: string): Header {
  if (HEADERS[pathname]) return HEADERS[pathname]
  const base = '/' + pathname.split('/')[1]
  return HEADERS[base] ?? { crumb: 'CIPHERLANE', title: 'Control Plane' }
}
