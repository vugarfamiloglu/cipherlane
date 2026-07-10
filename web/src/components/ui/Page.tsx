import type { ReactNode } from 'react'
import { Spinner, EmptyState } from './primitives'
import { Icon, type IconName } from './Icon'

export function PageHead({ title, desc, children }: { title: string; desc?: string; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="page-head-txt">
        <h1 className="page-title">{title}</h1>
        {desc && <p className="page-desc">{desc}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="page-loading">
      <Spinner size={22} />
      <span className="u-muted">{label}</span>
    </div>
  )
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card card-pad">
      <EmptyState
        icon="alert"
        title="Couldn’t load data"
        hint={message}
        action={onRetry && <button className="btn btn-default btn-sm" onClick={onRetry}>Retry</button>}
      />
    </div>
  )
}

export function StatTile({
  label, value, unit, sub, icon, tone, index = 0,
}: {
  label: string; value: ReactNode; unit?: string; sub?: ReactNode
  icon?: IconName; tone?: 'up' | 'warn' | 'down' | 'accent'; index?: number
}) {
  return (
    <div className={`stat ${tone ? 'stat-' + tone : ''}`} style={{ animationDelay: `${index * 55}ms` }}>
      <div className="stat-top">
        <span className="stat-label mono upper">{label}</span>
        {icon && <span className="stat-ic"><Icon name={icon} size={16} /></span>}
      </div>
      <div className="stat-value tnum">
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}
