import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { PageHead, Loading, ErrorNote } from '../components/ui/Page'
import { Card, Badge, Button, StatusBadge, KeyVal, EmptyState } from '../components/ui/primitives'
import { Icon } from '../components/ui/Icon'
import { providerLabel } from '../lib/kinds'
import { toast } from '../components/ui/Toaster'

export function CloudConnectors() {
  const { data, loading, error, reload } = useResource(() => api.cloud(), [])
  if (loading && !data) return <Loading label="Loading cloud connectors…" />
  if (error) return <ErrorNote message={error} onRetry={reload} />

  return (
    <>
      <PageHead title="Cloud Connectors" desc="Site-to-site links into AWS, Azure, and GCP virtual networks.">
        <Button variant="primary" size="sm" icon="plus" onClick={() => toast.info('Connect-cloud wizard opens here')}>Connect cloud</Button>
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
              <Button variant="default" icon="download" className="btn-block" style={{ width: '100%', marginTop: 'var(--sp-3)' }}
                onClick={() => toast.success(`${c.provider.toUpperCase()} tunnel config downloaded`)}>
                Download config
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="card-pad"><EmptyState icon="cloud" title="No cloud connectors" hint="Connect an AWS, Azure, or GCP VPC to extend the overlay." /></Card>
      )}
    </>
  )
}
