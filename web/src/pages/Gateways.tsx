import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { PageHead, Loading, ErrorNote } from '../components/ui/Page'
import { DataTable, type Column } from '../components/ui/DataTable'
import { StatusBadge, Badge } from '../components/ui/primitives'
import { timeAgo } from '../lib/format'
import type { Gateway } from '../lib/types'

export function Gateways() {
  const { data, loading, error, reload } = useResource(() => api.gateways(), [])
  if (loading && !data) return <Loading label="Loading gateways…" />
  if (error) return <ErrorNote message={error} onRetry={reload} />

  const cols: Column<Gateway>[] = [
    { key: 'status', header: 'State', width: 118, render: (g) => <StatusBadge status={g.status} /> },
    { key: 'name', header: 'Gateway', width: 180, render: (g) => <span className="cell-strong mono">{g.name}</span> },
    { key: 'siteName', header: 'Site', width: 170 },
    { key: 'endpoint', header: 'Endpoint', width: 220, mono: true },
    { key: 'protocol', header: 'Protocol', width: 120, render: (g) => <Badge>{g.protocol}</Badge> },
    { key: 'version', header: 'Version', width: 160, mono: true },
    { key: 'lastSeen', header: 'Last seen', width: 120, align: 'right', render: (g) => <span className="mono u-muted">{timeAgo(g.lastSeen)}</span> },
  ]

  return (
    <>
      <PageHead title="Gateways" desc="The router and firewall endpoints that terminate tunnels." />
      <DataTable columns={cols} rows={data ?? []} empty="No gateways registered." />
    </>
  )
}
