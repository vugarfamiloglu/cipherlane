import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { useLive } from '../lib/live'
import { PageHead, Loading, ErrorNote, StatTile } from '../components/ui/Page'
import { Card, Button } from '../components/ui/primitives'
import { ThroughputArea } from '../components/ui/Charts'
import { downloadText } from '../lib/ui'
import { toast } from '../components/ui/Toaster'
import { fmtRate, fmtRateParts } from '../lib/format'

const csvCell = (v: string | number) => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function Analytics() {
  const tuns = useResource(() => api.tunnels(), [])
  const { telemetry } = useLive()
  if (tuns.loading && !tuns.data) return <Loading label="Crunching analytics…" />
  if (tuns.error) return <ErrorNote message={tuns.error} onRetry={tuns.reload} />

  const g = telemetry?.global
  const series = telemetry?.series ?? []
  const rate = fmtRateParts(g ? g.rx + g.tx : 0)

  const ranked = [...(tuns.data ?? [])]
    .map((t) => { const l = telemetry?.tunnels[t.id] ?? t.live; return { t, total: l ? l.rxMbps + l.txMbps : 0 } })
    .sort((a, b) => b.total - a.total)
  const max = ranked[0]?.total || 1

  const lats = (tuns.data ?? []).map((t) => (telemetry?.tunnels[t.id] ?? t.live)?.latencyMs).filter((x): x is number => x != null)
  const avgLat = lats.length ? lats.reduce((a, b) => a + b, 0) / lats.length : 0

  const all = tuns.data ?? []
  const total = all.length
  const upCount = all.filter((t) => ((telemetry?.tunnels[t.id] ?? t.live)?.status ?? t.status) === 'up').length
  const availability = total ? (upCount / total) * 100 : 100

  const exportCsv = () => {
    const header = ['Tunnel', 'Protocol', 'Status', 'Rx Mbps', 'Tx Mbps', 'Total Mbps', 'Latency ms', 'Loss %']
    const lines = all.map((t) => {
      const l = telemetry?.tunnels[t.id] ?? t.live
      const rx = l?.rxMbps ?? 0, tx = l?.txMbps ?? 0
      return [t.name, t.protocol, l?.status ?? t.status, rx.toFixed(1), tx.toFixed(1), (rx + tx).toFixed(1), (l?.latencyMs ?? 0).toFixed(0), (l?.lossPct ?? 0).toFixed(2)]
    })
    const csv = [header, ...lines].map((r) => r.map(csvCell).join(',')).join('\n')
    downloadText(csv, `cipherlane-analytics-${new Date().toISOString().slice(0, 10)}.csv`)
    toast.success('Analytics exported as CSV')
  }

  return (
    <>
      <PageHead title="Analytics" desc="Traffic distribution, throughput trend, and per-link performance.">
        <Button size="sm" variant="default" icon="download" onClick={exportCsv}>Export CSV</Button>
      </PageHead>

      <div className="kpi-grid">
        <StatTile index={0} label="Link availability" value={availability.toFixed(1)} unit="%" sub={`${upCount}/${total} tunnels up`} icon="shield" tone={availability >= 100 ? 'up' : availability >= 80 ? 'warn' : 'down'} />
        <StatTile index={1} label="Aggregate now" value={rate.value} unit={rate.unit} icon="signal" />
        <StatTile index={2} label="Avg latency" value={avgLat.toFixed(0)} unit="ms" icon="monitoring" />
        <StatTile index={3} label="Active tunnels" value={g?.activeTunnels ?? 0} icon="tunnels" />
        <StatTile index={4} label="Online sessions" value={g?.onlineSessions ?? 0} icon="sessions" />
      </div>

      <Card className="card-pad section-block">
        <div className="card-head">
          <div className="card-title">Throughput trend</div>
          <span className="mono u-subtle" style={{ fontSize: 'var(--fs-xs)' }}>live · {series.length * 2}s window</span>
        </div>
        <ThroughputArea data={series} height={260} />
      </Card>

      <Card className="card-pad section-block">
        <div className="card-head"><div className="card-title">Top talkers</div></div>
        <div className="talkers">
          {ranked.map(({ t, total }) => (
            <div key={t.id} className="talker">
              <div className="talker-name">{t.name}<span className="mono u-subtle"> · {t.protocol}</span></div>
              <div className="talker-bar"><div className="talker-fill" style={{ width: `${Math.max(3, (total / max) * 100)}%` }} /></div>
              <div className="talker-val mono tnum">{fmtRate(total)}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
