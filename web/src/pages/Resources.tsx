import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { PageHead, Loading, ErrorNote } from '../components/ui/Page'
import { DataTable, type Column } from '../components/ui/DataTable'
import { Card, Badge, Button } from '../components/ui/primitives'
import { Icon } from '../components/ui/Icon'
import { resourceIcon } from '../lib/kinds'
import { toast } from '../components/ui/Toaster'
import type { Resource, Policy } from '../lib/types'

export function Resources() {
  const res = useResource(() => api.resources(), [])
  const pol = useResource(() => api.policies(), [])
  if (res.loading && !res.data) return <Loading label="Loading resources…" />
  if (res.error) return <ErrorNote message={res.error} onRetry={res.reload} />

  const resCols: Column<Resource>[] = [
    { key: 'name', header: 'Resource', width: 220, render: (r) => (<div className="row gap-2"><span className="res-ic"><Icon name={resourceIcon(r.kind)} size={15} /></span><span className="cell-strong">{r.name}</span></div>) },
    { key: 'kind', header: 'Kind', width: 110, render: (r) => <Badge>{r.kind}</Badge> },
    { key: 'endpoint', header: 'Endpoint', width: 190, mono: true, render: (r) => `${r.host}:${r.port}` },
    { key: 'siteName', header: 'Site', width: 170 },
  ]
  const polCols: Column<Policy>[] = [
    { key: 'name', header: 'Policy', width: 230, render: (p) => <span className="cell-strong">{p.name}</span> },
    { key: 'group', header: 'Group', width: 130 },
    { key: 'resourceName', header: 'Resource', width: 190 },
    { key: 'action', header: 'Action', width: 110, render: (p) => <Badge tone={p.action === 'allow' ? 'up' : 'down'}>{p.action}</Badge> },
  ]

  return (
    <>
      <PageHead title="Resources & Policies" desc="Internal assets and the rules that govern who can reach them.">
        <Button variant="primary" size="sm" icon="plus" onClick={() => toast.info('New policy builder opens here')}>New policy</Button>
      </PageHead>

      <Card className="card-pad section-block">
        <div className="card-head"><div className="card-title">Internal resources</div><Badge>{res.data?.length ?? 0}</Badge></div>
        <DataTable columns={resCols} rows={res.data ?? []} empty="No resources defined." />
      </Card>

      <Card className="card-pad section-block">
        <div className="card-head"><div className="card-title">Access policies</div><Badge>{pol.data?.length ?? 0}</Badge></div>
        <DataTable columns={polCols} rows={pol.data ?? []} empty="No policies defined." />
      </Card>
    </>
  )
}
