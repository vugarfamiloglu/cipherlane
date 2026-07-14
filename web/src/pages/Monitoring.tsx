import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { useLive } from '../lib/live'
import { PageHead, Loading, ErrorNote } from '../components/ui/Page'
import { DataTable, type Column } from '../components/ui/DataTable'
import { Card, Badge, Button, EmptyState } from '../components/ui/primitives'
import { timeAgo } from '../lib/format'
import { toast } from '../components/ui/Toaster'
import { errMsg } from '../lib/ui'
import type { Alert, AuditEvent } from '../lib/types'

function LiveLog() {
  const { telemetry, connected } = useLive()
  const [lines, setLines] = useState<string[]>([])
  useEffect(() => {
    if (!telemetry) return
    const g = telemetry.global
    const ts = new Date().toLocaleTimeString('en-GB')
    setLines((cur) => [...cur.slice(-40), `[${ts}] agg ↓${g.rx.toFixed(0)} ↑${g.tx.toFixed(0)} Mbps · ${g.activeTunnels} tunnels · ${g.onlineSessions} sessions`])
  }, [telemetry])
  return (
    <Card className="ov-panel">
      <div className="card-head">
        <div className="card-title">Live activity</div>
        <span className={`sbadge sbadge-${connected ? 'up' : 'idle'}`}><span className="sbadge-dot" />{connected ? 'streaming' : 'offline'}</span>
      </div>
      <div className="logmon mono">
        {lines.length ? lines.map((l, i) => <div key={i} className="logmon-line">{l}</div>) : <div className="u-subtle">Waiting for telemetry…</div>}
      </div>
    </Card>
  )
}

function AlertItem({ a, onResolve }: { a: Alert; onResolve: () => void }) {
  const tone = a.severity === 'critical' ? 'down' : a.severity === 'warning' ? 'warn' : 'idle'
  const resolve = async () => {
    try { await api.resolveAlert(a.id); toast.success('Alert resolved'); onResolve() } catch (e) { toast.error(errMsg(e)) }
  }
  return (
    <div className="feed-row">
      <span className={`dot dot-${tone}`} style={{ marginTop: 6 }} />
      <div className="grow"><div className="feed-title">{a.title}</div><div className="feed-sub">{a.detail}</div></div>
      {a.status === 'open'
        ? <Button size="sm" variant="ghost" onClick={resolve}>Resolve</Button>
        : <Badge tone="up">resolved</Badge>}
    </div>
  )
}

export function Monitoring() {
  const alerts = useResource(() => api.alerts(), [])
  const audit = useResource(() => api.audit(), [])
  if (alerts.loading && !alerts.data) return <Loading label="Loading monitoring…" />
  if (alerts.error) return <ErrorNote message={alerts.error} onRetry={alerts.reload} />

  const cols: Column<AuditEvent>[] = [
    { key: 'createdAt', header: 'When', width: 120, mono: true, render: (a) => timeAgo(a.createdAt) },
    { key: 'actor', header: 'Actor', width: 130, mono: true },
    { key: 'action', header: 'Action', width: 190, mono: true },
    { key: 'target', header: 'Target', width: 230 },
    { key: 'ip', header: 'IP', width: 140, mono: true },
  ]

  return (
    <>
      <PageHead title="Monitoring" desc="Operational alerts, a live event stream, and the full audit trail." />
      <div className="ov-grid ov-grid-a">
        <Card className="ov-panel">
          <div className="card-head"><div className="card-title">Alerts</div></div>
          <div className="feed">
            {(alerts.data ?? []).map((a) => <AlertItem key={a.id} a={a} onResolve={() => { alerts.reload(); audit.reload() }} />)}
            {!alerts.data?.length && <EmptyState icon="check" title="No alerts" hint="All systems nominal." />}
          </div>
        </Card>
        <LiveLog />
      </div>
      <Card className="card-pad section-block">
        <div className="card-head"><div className="card-title">Audit trail</div><Badge>{audit.data?.length ?? 0}</Badge></div>
        <DataTable columns={cols} rows={audit.data ?? []} empty="No audit events." />
      </Card>
    </>
  )
}
