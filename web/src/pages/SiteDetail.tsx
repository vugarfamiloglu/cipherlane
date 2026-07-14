import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { usePageHeader } from '../components/shell/AppShell'
import { Loading, ErrorNote, StatTile } from '../components/ui/Page'
import { Card, Button, Badge, StatusBadge, statusTone } from '../components/ui/primitives'
import { FormModal } from '../components/ui/FormModal'
import { Icon } from '../components/ui/Icon'
import { resourceIcon } from '../lib/kinds'
import { toast } from '../components/ui/Toaster'
import { confirmDelete } from '../lib/ui'
import type { Gateway } from '../lib/types'

export function SiteDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { data, loading, error, reload } = useResource(() => api.site(id!), [id])
  usePageHeader('SITE-TO-SITE', data?.site.name, data?.site.location)
  const [editing, setEditing] = useState(false)

  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorNote message={error ?? 'Site not found'} onRetry={reload} />

  const { site, tunnels, resources } = data
  return (
    <>
      <div className="between detail-topbar">
        <button className="back-link" style={{ marginBottom: 0 }} onClick={() => nav('/sites')}>
          <Icon name="chevronRight" size={14} style={{ transform: 'rotate(180deg)' }} /> Sites
        </button>
        <div className="detail-actions">
          <Button variant="default" size="sm" icon="edit" onClick={() => setEditing(true)}>Edit</Button>
          <Button variant="danger" size="sm" icon="trash" onClick={() => confirmDelete(site.name, () => api.deleteSite(site.id), () => nav('/sites'))}>Delete</Button>
        </div>
      </div>

      <div className="kpi-grid">
        <StatTile index={0} label="State" value={<StatusBadge status={site.status} />} />
        <StatTile index={1} label="Type" value={<span style={{ textTransform: 'capitalize' }}>{site.kind}</span>} icon="sites" />
        <StatTile index={2} label="Subnet" value={<span className="mono" style={{ fontSize: 'var(--fs-md)' }}>{site.subnetCidr}</span>} />
        <StatTile index={3} label="Tunnels" value={tunnels.length} icon="tunnels" />
      </div>

      <div className="ov-grid ov-grid-a">
        <Card className="ov-panel">
          <div className="card-head"><div className="card-title">Gateways</div></div>
          {(site.gateways ?? []).map((g) => <GatewayRow key={g.id} g={g} />)}
          {!site.gateways?.length && <div className="u-muted mono" style={{ fontSize: 'var(--fs-xs)' }}>No gateways registered.</div>}

          <div className="section-label mono upper" style={{ margin: 'var(--sp-5) 0 var(--sp-2)' }}>Tunnels</div>
          {tunnels.map((t) => (
            <button key={t.id} className="feed-row feed-clickable" onClick={() => nav(`/tunnels/${t.id}`)}>
              <span className={`dot dot-${statusTone(t.status)}`} />
              <div className="grow"><div className="feed-title">{t.name}</div><div className="feed-sub mono">{t.protocol} · {t.cipher}</div></div>
              <Icon name="chevronRight" size={14} className="u-subtle" />
            </button>
          ))}
          {!tunnels.length && <div className="u-muted mono" style={{ fontSize: 'var(--fs-xs)' }}>No tunnels touch this site.</div>}
        </Card>

        <Card className="ov-panel">
          <div className="card-head"><div className="card-title">Reachable resources</div><Badge>{resources.length}</Badge></div>
          {resources.map((r) => (
            <div key={r.id} className="feed-row">
              <span className="res-ic"><Icon name={resourceIcon(r.kind)} size={15} /></span>
              <div className="grow"><div className="feed-title">{r.name}</div><div className="feed-sub mono">{r.host}:{r.port}</div></div>
              <Badge>{r.kind}</Badge>
            </div>
          ))}
          {!resources.length && <div className="u-muted mono" style={{ fontSize: 'var(--fs-xs)' }}>No resources at this site.</div>}
        </Card>
      </div>

      {editing && (
        <FormModal title={`Edit ${site.name}`} submitLabel="Save changes" onClose={() => setEditing(false)}
          onSubmit={async (v) => { await api.updateSite(site.id, v); toast.success('Site updated'); reload() }}
          fields={[
            { name: 'name', label: 'Site name', required: true, default: site.name },
            { name: 'code', label: 'Code', default: site.code },
            { name: 'kind', label: 'Type', type: 'select', default: site.kind, options: ['branch', 'hq', 'datacenter', 'cloud'].map((k) => ({ value: k, label: k })) },
            { name: 'location', label: 'Location', default: site.location },
            { name: 'subnetCidr', label: 'Subnet', default: site.subnetCidr },
            { name: 'status', label: 'Status', type: 'select', default: site.status, options: ['online', 'degraded', 'offline'].map((k) => ({ value: k, label: k })) },
          ]} />
      )}
    </>
  )
}

function GatewayRow({ g }: { g: Gateway }) {
  return (
    <div className="feed-row">
      <span className={`dot dot-${statusTone(g.status)}`} />
      <div className="grow"><div className="feed-title">{g.name}</div><div className="feed-sub mono">{g.endpoint}</div></div>
      <Badge>{g.protocol}</Badge>
    </div>
  )
}
