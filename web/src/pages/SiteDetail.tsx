import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { usePageHeader } from '../components/shell/AppShell'
import { Loading, ErrorNote, StatTile } from '../components/ui/Page'
import { Card, Badge, StatusBadge, statusTone } from '../components/ui/primitives'
import { Icon } from '../components/ui/Icon'
import { resourceIcon } from '../lib/kinds'
import type { Gateway } from '../lib/types'

export function SiteDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { data, loading, error, reload } = useResource(() => api.site(id!), [id])
  usePageHeader('SITE-TO-SITE', data?.site.name, data?.site.location)

  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorNote message={error ?? 'Site not found'} onRetry={reload} />

  const { site, tunnels, resources } = data
  return (
    <>
      <button className="back-link" onClick={() => nav('/sites')}>
        <Icon name="chevronRight" size={14} style={{ transform: 'rotate(180deg)' }} /> Sites
      </button>

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
