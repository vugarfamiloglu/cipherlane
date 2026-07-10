// Small, dependency-free formatting helpers with tabular-friendly output.

export function fmtRate(mbps: number): string {
  if (mbps >= 1000) return (mbps / 1000).toFixed(2) + ' Gbps'
  return mbps.toFixed(1) + ' Mbps'
}

export function fmtRateParts(mbps: number): { value: string; unit: string } {
  if (mbps >= 1000) return { value: (mbps / 1000).toFixed(2), unit: 'Gbps' }
  return { value: mbps.toFixed(1), unit: 'Mbps' }
}

export const fmtInt = (n: number): string => Math.round(n).toLocaleString('en-US')
export const fmt1 = (n: number): string => (Math.round(n * 10) / 10).toString()

export function timeAgo(unixSec: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - unixSec))
  if (s < 60) return s + 's ago'
  const m = Math.floor(s / 60)
  if (m < 60) return m + 'm ago'
  const h = Math.floor(m / 60)
  if (h < 24) return h + 'h ago'
  const d = Math.floor(h / 24)
  return d + 'd ago'
}

export function duration(fromUnixSec: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - fromUnixSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function countdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m}m ${r}s` : `${r}s`
}

export function fmtDateTime(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function fmtDate(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export const titleCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
