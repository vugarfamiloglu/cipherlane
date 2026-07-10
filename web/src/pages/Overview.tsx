import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { useLive } from '../lib/live'
import { PageHead, Loading, ErrorNote, StatTile } from '../components/ui/Page'
import { Card, StatusDot, Badge, EmptyState } from '../components/ui/primitives'
import { ThroughputArea } from '../components/ui/Charts'
import { fmtRate, fmtRateParts, timeAgo } from '../lib/format'
import type { Alert, Tunnel, TunnelLive, Session } from '../lib/types'

export function Overview() {
  const ov = useResource(() => api.overview(), [])
  const tuns = useResource(() => api.tunnels(), [])
  const sess = useResource(() => api.sessions(), [])
  const { telemetry } = useLive()
  const nav = useNavigate()

  if (ov.loading && !ov.data) return <Loading label="Reading control plane…" />
  if (ov.error) return <ErrorNote message={ov.error} onRetry={ov.reload} />

  const g = telemetry?.global
  const series = telemetry?.series ?? ov.data?.series ?? []
  const c = ov.data?.counts ?? {}
  const rate = fmtRateParts(g ? g.rx + g.tx : 0)
  const openAlerts = c.alertsOpen ?? 0

  return (
    <>
      <PageHead title="Control Overview" desc="Live posture across every site, tunnel, and remote session." />

      <div className="kpi-grid">
        <StatTile index={0} label="Live throughput" value={rate.value} unit={rate.unit} icon="signal" sub="aggregate ↓rx · ↑tx" />
        <StatTile index={1} label="Active tunnels" value={g?.activeTunnels ?? c.tunnelsUp ?? 0} icon="tunnels" sub={`of ${c.tunnels ?? '–'} configured`} />
        <StatTile index={2} label="Online sessions" value={g?.onlineSessions ?? c.onlineSessions ?? 0} icon="sessions" sub={`${c.users ?? '–'} users`} />
        <StatTile index={3} label="Sites online" value={c.sitesOnline ?? 0} icon="sites" sub={`of ${c.sites ?? '–'} total`} />
        <StatTile index={4} label="Open alerts" value={openAlerts} icon="alert" tone={openAlerts > 0 ? 'warn' : undefined} sub={openAlerts > 0 ? 'needs attention' : 'all clear'} />
      </div>

      <div className="ov-grid ov-grid-a">
        <Card className="ov-panel">
          <div className="card-head">
            <div className="card-title">Aggregate throughput</div>
            <span className="mono u-subtle" style={{ fontSize: 'var(--fs-xs)' }}>last {series.length * 2}s</span>
          </div>
          <ThroughputArea data={series} height={232} />
        </Card>

        <Card className="ov-panel">
          <div className="card-head">
            <div className="card-title">Alerts</div>
            {openAlerts ? <Badge tone="warn">{openAlerts} open</Badge> : <Badge tone="up">clear</Badge>}
          </div>
          <div className="feed">
            {(ov.data?.alerts ?? []).map((a) => <AlertRow key={a.id} a={a} />)}
            {!ov.data?.alerts?.length && <EmptyState icon="check" title="No alerts" hint="Everything is nominal." />}
          </div>
        </Card>
      </div>

      <div className="ov-grid ov-grid-b">
        <Card className="ov-panel">
          <div className="card-head">
            <div className="card-title">Tunnel health</div>
            <Link to="/tunnels" className="card-link mono">All tunnels →</Link>
          </div>
          <div className="feed">
            {(tuns.data ?? []).map((t) => (
              <TunnelHealthRow key={t.id} t={t} live={telemetry?.tunnels[t.id]} onClick={() => nav(`/tunnels/${t.id}`)} />
            ))}
            {tuns.loading && !tuns.data && <div className="u-muted mono" style={{ padding: 'var(--sp-4)' }}>Linking…</div>}
          </div>
        </Card>

        <Card className="ov-panel">
          <div className="card-head">
            <div className="card-title">Live sessions</div>
            <Link to="/sessions" className="card-link mono">All →</Link>
          </div>
          <div className="feed">
            {(sess.data ?? []).filter((s) => s.status === 'connected').slice(0, 6).map((s) => (
              <SessionRow key={s.id} s={s} live={telemetry?.sessions[s.id]} />
            ))}
            {!sess.data?.some((s) => s.status === 'connected') && !sess.loading && (
              <EmptyState icon="sessions" title="No live sessions" hint="Remote users will appear here when connected." />
            )}
          </div>
        </Card>
      </div>
    </>
  )
}

function AlertRow({ a }: { a: Alert }) {
  const tone = a.severity === 'critical' ? 'down' : a.severity === 'warning' ? 'warn' : 'idle'
  return (
    <div className="feed-row">
      <span className={`dot dot-${tone}`} style={{ marginTop: 6 }} />
      <div className="grow">
        <div className="feed-title">{a.title}</div>
        <div className="feed-sub">{a.detail}</div>
      </div>
      <span className="mono u-subtle feed-time">{timeAgo(a.createdAt)}</span>
    </div>
  )
}

function TunnelHealthRow({ t, live, onClick }: { t: Tunnel; live?: TunnelLive; onClick: () => void }) {
  const l = live ?? t.live
  const total = l ? l.rxMbps + l.txMbps : 0
  const status = l?.status ?? t.status
  return (
    <button className="feed-row feed-clickable" onClick={onClick}>
      <StatusDot status={status} pulse={status !== 'down'} />
      <div className="grow">
        <div className="feed-title">{t.name}</div>
        <div className="feed-sub mono">{t.protocol} · {t.cipher}</div>
      </div>
      <div className="feed-metric">
        <span className="mono tnum feed-metric-val">{fmtRate(total)}</span>
        <span className="mono u-subtle">{l ? `${l.latencyMs.toFixed(0)} ms` : '–'}</span>
      </div>
    </button>
  )
}

function SessionRow({ s, live }: { s: Session; live?: { rxMbps: number; txMbps: number; status: string } }) {
  const total = (live?.rxMbps ?? s.rxMbps) + (live?.txMbps ?? s.txMbps)
  return (
    <div className="feed-row">
      <span className="avatar">{s.userName.charAt(0)}</span>
      <div className="grow">
        <div className="feed-title">{s.userName}</div>
        <div className="feed-sub mono">{s.location} · {s.assignedIp}</div>
      </div>
      <span className="mono tnum feed-metric-val">{fmtRate(total)}</span>
    </div>
  )
}
