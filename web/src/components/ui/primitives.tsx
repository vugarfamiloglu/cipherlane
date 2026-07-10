import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export type Tone = 'up' | 'warn' | 'down' | 'idle' | 'accent'

// Map any backend status string to one of four visual tones.
export function statusTone(status: string): Tone {
  const v = (status || '').toLowerCase()
  if (['up', 'online', 'connected', 'valid', 'active', 'allow', 'resolved', 'ok', 'healthy'].includes(v)) return 'up'
  if (['rekeying', 'degraded', 'idle', 'warning', 'pending', 'suspended', 'warn'].includes(v)) return 'warn'
  if (['down', 'offline', 'revoked', 'expired', 'deny', 'critical', 'error', 'failed'].includes(v)) return 'down'
  return 'idle'
}

export function StatusDot({ status, pulse }: { status: string; pulse?: boolean }) {
  return <span className={`dot dot-${statusTone(status)} ${pulse ? 'dot-pulse' : ''}`} aria-hidden />
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`sbadge sbadge-${statusTone(status)}`}>
      <span className="sbadge-dot" />
      {label ?? status}
    </span>
  )
}

export function Badge({ tone = 'idle', children }: { tone?: Tone | 'neutral'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Card({ children, className = '', pad = true, ...rest }: { children: ReactNode; className?: string; pad?: boolean } & HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${pad ? 'card-pad' : ''} ${className}`} {...rest}>{children}</div>
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'default' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  icon?: IconName
}
export function Button({ variant = 'default', size = 'md', icon, className = '', children, ...rest }: BtnProps) {
  return (
    <button className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 16} />}
      {children}
    </button>
  )
}

export function Skeleton({ w = '100%', h = 14, r = 6, className = '' }: { w?: number | string; h?: number | string; r?: number; className?: string }) {
  return <span className={`skeleton ${className}`} style={{ width: w, height: h, borderRadius: r }} />
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg className="spinner" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export function EmptyState({ icon = 'dot', title, hint, action }: { icon?: IconName; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-mark"><Icon name={icon} size={22} /></div>
      <div className="empty-title">{title}</div>
      {hint && <div className="empty-hint">{hint}</div>}
      {action}
    </div>
  )
}

export function KeyVal({ k, v, mono }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="kv">
      <dt className="mono upper">{k}</dt>
      <dd className={mono ? 'mono' : ''}>{v}</dd>
    </div>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="section-label mono upper">{children}</div>
}
