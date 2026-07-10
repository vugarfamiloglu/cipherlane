import { useLocation } from 'react-router-dom'
import { deriveHeader } from './nav'
import { Icon } from '../ui/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'
import { useLive } from '../../lib/live'
import { confirmModal } from '../ui/Modal'
import { fmtRateParts } from '../../lib/format'

interface Override { crumb: string; title: string; subtitle?: string }

export function TopBar({ override, onMenu }: { override: Override | null; onMenu: () => void }) {
  const loc = useLocation()
  const h = override ?? deriveHeader(loc.pathname)
  const { theme, toggle } = useTheme()
  const { logout } = useAuth()
  const { telemetry, connected } = useLive()

  const g = telemetry?.global
  const rate = g ? fmtRateParts(g.rx + g.tx) : null

  const onSignOut = async () => {
    const ok = await confirmModal({
      title: 'Sign out of Cipherlane?',
      message: 'Your control-plane session ends and you return to the sign-in screen.',
      confirmText: 'Sign out',
      tone: 'danger',
    })
    if (ok) await logout()
  }

  return (
    <header className="topbar">
      <button className="tb-menu" onClick={onMenu} aria-label="Open navigation menu">
        <Icon name="menu" size={20} />
      </button>
      <div className="tb-left">
        <span className="tb-mark"><Icon name="shield" size={15} /></span>
        <Icon name="chevronRight" size={13} className="tb-chev" />
        <span className="tb-crumb mono upper">{h.crumb}</span>
        <span className="tb-div" />
        <div className="tb-titles">
          <span className="tb-title">{h.title}</span>
          {h.subtitle && <span className="tb-sub">{h.subtitle}</span>}
        </div>
      </div>

      <div className="tb-badge" title="Aggregate live throughput across all tunnels and sessions">
        <span className={`tb-badge-dot ${connected ? 'is-live' : ''}`} />
        <span className="tb-badge-val mono tnum">{rate ? rate.value : '—'}</span>
        <span className="tb-badge-unit mono">{rate ? rate.unit : 'Mbps'}</span>
        <span className="tb-badge-sep" />
        <span className="mono u-muted tnum">{g ? `${g.activeTunnels} tunnels` : 'linking…'}</span>
      </div>

      <div className="tb-right">
        <button className="tb-icon-btn" onClick={toggle} title="Toggle theme" aria-label="Toggle light or dark theme">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>
        <button className="tb-icon-btn" onClick={onSignOut} title="Sign out" aria-label="Sign out">
          <Icon name="logout" size={18} />
        </button>
      </div>
    </header>
  )
}
