import type { IconName } from '../components/ui/Icon'

// Map a resource kind to the closest icon in the set.
export function resourceIcon(kind: string): IconName {
  switch (kind) {
    case 'db':
    case 'file':
    case 'nas':
    case 'backup': return 'resources'
    case 'web': return 'cloud'
    case 'ad': return 'shield'
    case 'erp': return 'analytics'
    case 'ssh': return 'key'
    case 'rdp':
    case 'printer': return 'gateways'
    case 'mail': return 'sessions'
    default: return 'dot'
  }
}

const PLATFORM: Record<string, IconName> = {
  windows: 'overview', macos: 'overview', linux: 'monitoring', android: 'sessions', ios: 'sessions',
}
export function platformIcon(p: string): IconName {
  return PLATFORM[p] ?? 'dot'
}

export function providerLabel(p: string): string {
  return { aws: 'Amazon Web Services', azure: 'Microsoft Azure', gcp: 'Google Cloud' }[p] ?? p.toUpperCase()
}
