import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { useLive } from '../lib/live'
import { PageHead, Loading, ErrorNote } from '../components/ui/Page'
import { DataTable, type Column } from '../components/ui/DataTable'
import { StatusBadge, Badge, Button } from '../components/ui/primitives'
import { fmtRate } from '../lib/format'
import { toast } from '../components/ui/Toaster'
import type { Tunnel } from '../lib/types'

export function Tunnels() {
  const { data, loading, error, reload } = useResource(() => api.tunnels(), [])
  const { telemetry } = useLive()
  const nav = useNavigate()
  if (loading && !data) return <Loading label="Loading tunnels…" />
  if (error) return <ErrorNote message={error} onRetry={reload} />

  const live = (t: Tunnel) => telemetry?.tunnels[t.id] ?? t.live

  const cols: Column<Tunnel>[] = [
    { key: 'status', header: 'State', width: 118, render: (t) => <StatusBadge status={live(t)?.status ?? t.status} /> },
    { key: 'name', header: 'Tunnel', width: 230, render: (t) => (<div><div className="cell-strong">{t.name}</div><div className="cell-sub mono">{t.aSiteName} ⇄ {t.bSiteName}</div></div>) },
    { key: 'protocol', header: 'Protocol', width: 116, render: (t) => <Badge>{t.protocol}</Badge> },
    { key: 'cipher', header: 'Cipher', width: 176, mono: true, render: (t) => t.cipher },
    { key: 'rate', header: 'Throughput', width: 128, align: 'right', render: (t) => { const l = live(t); return <span className="mono tnum">{l ? fmtRate(l.rxMbps + l.txMbps) : '–'}</span> } },
    { key: 'lat', header: 'Latency', width: 104, align: 'right', render: (t) => { const l = live(t); return <span className="mono tnum">{l ? `${l.latencyMs.toFixed(0)} ms` : '–'}</span> } },
    { key: 'routing', header: 'Routing', width: 100, mono: true, render: (t) => t.routing },
    { key: 'alwaysOn', header: 'Always-on', width: 108, align: 'center', render: (t) => <span className={`dot dot-${t.alwaysOn ? 'up' : 'idle'}`} /> },
  ]

  return (
    <>
      <PageHead title="Tunnels" desc="Encrypted site-to-site links across the estate.">
        <Button variant="primary" size="sm" icon="plus" onClick={() => toast.info('Tunnel wizard opens here')}>New tunnel</Button>
      </PageHead>
      <DataTable columns={cols} rows={data ?? []} onRowClick={(t) => nav(`/tunnels/${t.id}`)} empty="No tunnels configured yet." />
    </>
  )
}
