import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { PageHead, Loading, ErrorNote } from '../components/ui/Page'
import { DataTable, type Column } from '../components/ui/DataTable'
import { StatusBadge, Badge, Button } from '../components/ui/primitives'
import { FormModal } from '../components/ui/FormModal'
import { toast } from '../components/ui/Toaster'
import type { Site } from '../lib/types'

export function Sites() {
  const { data, loading, error, reload } = useResource(() => api.sites(), [])
  const nav = useNavigate()
  const [wizard, setWizard] = useState(false)

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
        <Button variant="primary" size="sm" icon="plus" onClick={() => setWizard(true)}>Add site</Button>
      </PageHead>
      <DataTable columns={cols} rows={data ?? []} onRowClick={(s) => nav(`/sites/${s.id}`)} empty="No sites yet."
        search={(s) => `${s.name} ${s.code} ${s.location} ${s.subnetCidr} ${s.kind} ${s.status}`} searchPlaceholder="Search sites…" />

      {wizard && (
        <FormModal
          title="Add site"
          submitLabel="Create site"
          onClose={() => setWizard(false)}
          onSubmit={async (v) => {
            await api.createSite({ name: v.name, code: v.code, kind: v.kind, location: v.location, subnetCidr: v.subnetCidr })
            toast.success('Site created')
            reload()
          }}
          fields={[
            { name: 'name', label: 'Site name', placeholder: 'e.g. Warehouse', required: true },
            { name: 'code', label: 'Code', placeholder: 'e.g. WH-01', required: true },
            { name: 'kind', label: 'Type', type: 'select', options: [{ value: 'branch', label: 'Branch' }, { value: 'hq', label: 'HQ' }, { value: 'datacenter', label: 'Datacenter' }, { value: 'cloud', label: 'Cloud VPC' }] },
            { name: 'location', label: 'Location', placeholder: 'e.g. Baku, AZ' },
            { name: 'subnetCidr', label: 'Subnet (CIDR)', placeholder: 'e.g. 10.60.0.0/16' },
          ]}
        />
      )}
    </>
  )
}
