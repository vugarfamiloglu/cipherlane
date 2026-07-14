import { useState } from 'react'
import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { PageHead, Loading, ErrorNote } from '../components/ui/Page'
import { Card, Badge, Button, StatusBadge, KeyVal, EmptyState } from '../components/ui/primitives'
import { FormModal, type Field } from '../components/ui/FormModal'
import { providerLabel } from '../lib/kinds'
import { toast } from '../components/ui/Toaster'
import { confirmDelete, downloadFile, errMsg } from '../lib/ui'
import type { CloudConnector } from '../lib/types'

const cloudFields: Field[] = [
  { name: 'name', label: 'Connector name', required: true, placeholder: 'AWS Production' },
  { name: 'provider', label: 'Provider', type: 'select', options: [{ value: 'aws', label: 'Amazon Web Services' }, { value: 'azure', label: 'Microsoft Azure' }, { value: 'gcp', label: 'Google Cloud' }] },
  { name: 'region', label: 'Region', placeholder: 'eu-central-1' },
  { name: 'vpcId', label: 'VPC / VNet ID', placeholder: 'vpc-0abc123' },
  { name: 'subnetCidr', label: 'Remote subnet', placeholder: '10.60.0.0/16' },
]

export function CloudConnectors() {
  const { data, loading, error, reload } = useResource(() => api.cloud(), [])
  const [creating, setCreating] = useState(false)

  if (loading && !data) return <Loading label="Loading cloud connectors…" />
  if (error) return <ErrorNote message={error} onRetry={reload} />

  const download = async (c: CloudConnector) => {
    try { await downloadFile(`/api/cloud/${c.id}/config`, `cipherlane-${c.provider}-${c.region}.conf`); toast.success('Config downloaded') }
    catch (e) { toast.error(errMsg(e)) }
  }

  return (
    <>
      <PageHead title="Cloud Connectors" desc="Site-to-site links into AWS, Azure, and GCP virtual networks.">
        <Button variant="primary" size="sm" icon="plus" onClick={() => setCreating(true)}>Connect cloud</Button>
      </PageHead>

      {data && data.length > 0 ? (
        <div className="cloud-grid">
          {data.map((c) => (
            <Card key={c.id} className="cloud-card card-pad">
              <div className="between">
                <span className="cloud-provider mono upper">{c.provider}</span>
                <StatusBadge status={c.status} />
              </div>
              <div className="cloud-name">{providerLabel(c.provider)}</div>
              <dl className="kv-list" style={{ marginTop: 'var(--sp-2)' }}>
                <KeyVal k="Region" v={c.region} mono />
                <KeyVal k="VPC" v={c.vpcId} mono />
                <KeyVal k="Site" v={c.siteName} />
              </dl>
              <div className="row gap-2" style={{ marginTop: 'var(--sp-3)' }}>
                <Button variant="default" size="sm" icon="download" className="grow" onClick={() => download(c)}>Config</Button>
                <Button variant="ghost" size="sm" icon="trash" onClick={() => confirmDelete(c.siteName || c.provider, () => api.deleteCloud(c.id), reload)}>Remove</Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="card-pad"><EmptyState icon="cloud" title="No cloud connectors" hint="Connect an AWS, Azure, or GCP VPC to extend the overlay." /></Card>
      )}

      {creating && <FormModal title="Connect a cloud VPC" submitLabel="Connect" onClose={() => setCreating(false)} onSubmit={async (v) => { await api.createCloud(v); toast.success('Cloud connected'); reload() }} fields={cloudFields} />}
    </>
  )
}
