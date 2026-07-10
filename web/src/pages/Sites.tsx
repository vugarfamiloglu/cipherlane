import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { PageHead, Loading, ErrorNote } from '../components/ui/Page'
import { DataTable, type Column } from '../components/ui/DataTable'
import { StatusBadge, Badge, Button } from '../components/ui/primitives'
import { toast } from '../components/ui/Toaster'
import type { Site } from '../lib/types'

export function Sites() {
  const { data, loading, error, reload } = useResource(() => api.sites(), [])
  const nav = useNavigate()
  if (loading && !data) return <Loading label="Loading sites…" />
  if (error) return <ErrorNote message={error} onRetry={reload} />

  const cols: Column<Site>[] = [
    { key: 'status', header: 'State', width: 118, render: (s) => <StatusBadge status={s.status} /> },
    { key: 'name', header: 'Site', width: 230, render: (s) => (<div><div className="cell-strong">{s.name}</div><div className="cell-sub mono">{s.code}</div></div>) },
    { key: 'kind', header: 'Type', width: 132, render: (s) => <Badge>{s.kind}</Badge> },
    { key: 'location', header: 'Location', width: 176 },
    { key: 'subnetCidr', header: 'Subnet', width: 150, mono: true },
    { key: 'tunnelCount', header: 'Tunnels', width: 104, align: 'right', mono: true },
  ]

  return (
    <>
      <PageHead title="Sites" desc="Offices, datacenters, and cloud VPCs on the private overlay.">
        <Button variant="primary" size="sm" icon="plus" onClick={() => toast.info('Add-site wizard opens here')}>Add site</Button>
      </PageHead>
      <DataTable columns={cols} rows={data ?? []} onRowClick={(s) => nav(`/sites/${s.id}`)} empty="No sites yet." />
    </>
  )
}
