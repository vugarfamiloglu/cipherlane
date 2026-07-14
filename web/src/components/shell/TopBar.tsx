import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { deriveHeader } from './nav'
import { Icon } from '../ui/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'
import { useLive } from '../../lib/live'
import { confirmModal } from '../ui/Modal'
import { toast } from '../ui/Toaster'
import { openCommandPalette } from '../ui/CommandPalette'
import { fmtRateParts, timeAgo } from '../../lib/format'
import { api } from '../../lib/api'
import type { Alert } from '../../lib/types'

interface Override { crumb: string; title: string; subtitle?: string }

export function TopBar({ override, onMenu }: { override: Override | null; onMenu: () => void }) {
  const loc = useLocation()
  const h = override ?? deriveHeader(loc.pathname)
  const { theme, toggle } = useTheme()
  const { logout, role } = useAuth()
  const { telemetry, connected } = useLive()

  const g = telemetry?.global
  const rate = g ? fmtRateParts(g.rx + g.tx) : null

  const [alerts, setAlerts] = useState<Alert[]>([])
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  const loadAlerts = () => api.alerts().then((a) => setAlerts(a.filter((x) => x.status === 'open'))).catch(() => {})
  useEffect(() => {
    loadAlerts()
    const t = window.setInterval(loadAlerts, 20000)
    return () => clearInterval(t)
  }, [loc.pathname])
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const resolve = async (a: Alert) => {
    try { await api.resolveAlert(a.id); toast.success('Alert resolved'); loadAlerts() } catch { /* read-only or gone */ }
  }
  const onSignOut = async () => {
    if (await confirmModal({ title: 'Sign out of Cipherlane?', message: 'Your session ends and you return to the sign-in screen.', confirmText: 'Sign out', tone: 'danger' })) await logout()
  }

  return (
    <header className="topbar">
      <button className="tb-menu" onClick={onMenu} aria-label="Open navigation menu"><Icon name="menu" size={20} /></button>
      <div className="tb-left">
        <span className="tb-mark"><Icon name="shield" size={15} /></span>
        <Icon name="chevronRight" size={13} className="tb-chev" />
        <span className="tb-crumb mono upper">{h.crumb}</span>
        <span className="tb-div" />
        <div className="tb-titles">
          <span className="tb-title">{h.title}</span>
          {h.subtitle && <span className="tb-sub">{h.subtitle}</span>}
        </div>
        {role === 'auditor' && <span className="ro-chip mono">READ-ONLY</span>}
      </div>

      <div className="tb-badge" title="Aggregate live throughput across all tunnels and sessions">
        <span className={`tb-badge-dot ${connected ? 'is-live' : ''}`} />
        <span className="tb-badge-val mono tnum">{rate ? rate.value : '—'}</span>
        <span className="tb-badge-unit mono">{rate ? rate.unit : 'Mbps'}</span>
        <span className="tb-badge-sep" />
        <span className="mono u-muted tnum">{g ? `${g.activeTunnels} tunnels` : 'linking…'}</span>
      </div>

      <div className="tb-right">
        <button className="tb-icon-btn" onClick={() => openCommandPalette()} title="Search (⌘K)" aria-label="Command palette"><Icon name="search" size={18} /></button>

        <div className="tb-bell-wrap" ref={bellRef}>
          <button className="tb-icon-btn" onClick={() => { setBellOpen((o) => !o); loadAlerts() }} title="Notifications" aria-label="Notifications">
            <Icon name="alert" size={18} />
            {alerts.length > 0 && <span className="tb-bell-badge">{alerts.length}</span>}
          </button>
          {bellOpen && (
            <div className="tb-bell-menu">
              <div className="tb-bell-head mono upper">Open alerts</div>
              {alerts.length ? alerts.map((a) => (
                <div key={a.id} className="tb-bell-item">
                  <span className={`dot dot-${a.severity === 'critical' ? 'down' : a.severity === 'warning' ? 'warn' : 'idle'}`} style={{ marginTop: 5 }} />
                  <div className="grow">
                    <div className="tb-bell-title">{a.title}</div>
                    <div className="tb-bell-detail">{a.detail}</div>
                    <div className="tb-bell-time mono">{timeAgo(a.createdAt)}</div>
                  </div>
                  {role !== 'auditor' && <button className="tb-bell-resolve" onClick={() => resolve(a)}>Resolve</button>}
                </div>
              )) : <div className="tb-bell-empty u-muted">No open alerts.</div>}
            </div>
          )}
        </div>

        <button className="tb-icon-btn" onClick={toggle} title="Toggle theme" aria-label="Toggle light or dark theme"><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} /></button>
        <button className="tb-icon-btn" onClick={onSignOut} title="Sign out" aria-label="Sign out"><Icon name="logout" size={18} /></button>
      </div>
    </header>
  )
}
