import { NavLink } from 'react-router-dom'
import { NAV } from './nav'
import { Icon } from '../ui/Icon'

function BrandMark() {
  return (
    <span className="sb-mark" aria-hidden>
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <rect x="1" y="1" width="24" height="24" rx="7" fill="var(--primary-soft)" stroke="var(--primary)" strokeWidth="1.3" />
        <circle cx="8.5" cy="13" r="2.1" fill="var(--primary)" />
        <circle cx="17.5" cy="13" r="2.1" fill="var(--primary)" />
        <path d="M10.6 13h4.8" stroke="var(--primary)" strokeWidth="1.6" strokeDasharray="2 2" />
      </svg>
    </span>
  )
}

// The rail always renders labels; the collapsed (icon-only) look is applied
// purely with CSS so the mobile drawer can reveal full labels regardless.
export function Sidebar({ collapsed, onToggle, onNavigate }: { collapsed: boolean; onToggle: () => void; onNavigate?: () => void }) {
  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <BrandMark />
        <span className="sb-word">Cipher<span className="sb-word-accent">lane</span></span>
      </div>

      <nav className="sb-nav">
        {NAV.map((group) => (
          <div key={group.label} className="sb-group">
            <div className="sb-group-label mono upper">{group.label}</div>
            {group.items.map((it) => (
              <NavLink key={it.path} to={it.path} end={it.path === '/'} onClick={onNavigate}
                className={({ isActive }) => `sb-link ${isActive ? 'is-active' : ''}`}
                title={collapsed ? it.label : undefined}>
                <span className="sb-ic"><Icon name={it.icon} size={18} /></span>
                <span className="sb-label">{it.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sb-foot">
        <button className="sb-collapse" onClick={onToggle} title={collapsed ? 'Expand' : 'Collapse'}>
          <Icon name="menu" size={18} />
          <span className="mono upper">Collapse</span>
        </button>
        <div className="sb-tag mono">encrypted lanes · v0.2</div>
      </div>
    </aside>
  )
}
