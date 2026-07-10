import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { useLive } from '../lib/live'
import { PageHead, Loading, ErrorNote } from '../components/ui/Page'
import { Button, StatusBadge, KeyVal } from '../components/ui/primitives'
import { fmtRate } from '../lib/format'
import { statusTone } from '../components/ui/primitives'
import type { Site, Tunnel } from '../lib/types'

const CX = 480, CY = 292, R = 210, NW = 150, NH = 56

interface Node { id: string; name: string; code: string; sub: string; kind: string; status: string; x: number; y: number; virtual?: boolean }

export function Topology() {
  const sitesR = useResource(() => api.sites(), [])
  const tunsR = useResource(() => api.tunnels(), [])
  const sessR = useResource(() => api.sessions(), [])
  const { telemetry } = useLive()
  const nav = useNavigate()
  const [selected, setSelected] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)

  const online = telemetry?.global.onlineSessions ?? sessR.data?.filter((s) => s.status === 'connected').length ?? 0

  const nodes = useMemo<Node[]>(() => {
    const sites = sitesR.data ?? []
    if (!sites.length) return []
    const hub = sites.find((s) => s.kind === 'hq') ?? sites[0]
    const ring: Node[] = sites
      .filter((s) => s.id !== hub.id)
      .map((s) => ({ id: s.id, name: s.name, code: s.code, sub: s.subnetCidr, kind: s.kind, status: s.status, x: 0, y: 0 }))
    ring.push({ id: '__remote__', name: 'Remote Workforce', code: 'RA', sub: `${online} online`, kind: 'remote', status: online > 0 ? 'online' : 'idle', x: 0, y: 0, virtual: true })
    ring.forEach((n, i) => {
      const a = (-90 + (i * 360) / ring.length) * (Math.PI / 180)
      n.x = CX + R * Math.cos(a)
      n.y = CY + R * Math.sin(a)
    })
    return [{ id: hub.id, name: hub.name, code: hub.code, sub: hub.subnetCidr, kind: hub.kind, status: hub.status, x: CX, y: CY }, ...ring]
  }, [sitesR.data, online])

  const posOf = (id: string) => nodes.find((n) => n.id === id)
  const hubId = nodes[0]?.id

  const edges = useMemo(() => {
    const list: { id: string; name: string; ax: number; ay: number; bx: number; by: number; status: string; live?: number }[] = []
    for (const t of tunsR.data ?? []) {
      const a = posOf(t.aSiteId), b = posOf(t.bSiteId)
      if (!a || !b) continue
      const live = telemetry?.tunnels[t.id]
      list.push({ id: t.id, name: t.name, ax: a.x, ay: a.y, bx: b.x, by: b.y, status: live?.status ?? t.status, live: live ? live.rxMbps + live.txMbps : undefined })
    }
    const hub = posOf(hubId), rem = posOf('__remote__')
    if (hub && rem) list.push({ id: '__ra__', name: 'Remote access', ax: hub.x, ay: hub.y, bx: rem.x, by: rem.y, status: online > 0 ? 'up' : 'idle' })
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tunsR.data, nodes, telemetry, online])

  if (sitesR.loading && !sitesR.data) return <Loading label="Mapping topology…" />
  if (sitesR.error) return <ErrorNote message={sitesR.error} onRetry={sitesR.reload} />

  const selSite = (sitesR.data ?? []).find((s) => s.id === selected)
  const selTunnels = (tunsR.data ?? []).filter((t) => t.aSiteId === selected || t.bSiteId === selected)

  return (
    <>
      <PageHead title="Network Topology" desc="Every site, encrypted tunnel, and the remote-access mesh — live." />
      <div className="topo-layout">
        <div className="card topo-canvas grid-bg">
          <svg viewBox="0 0 960 600" className="topo-svg" role="img" aria-label="Network topology map">
            {edges.map((e) => {
              const on = hover === e.id
              return (
                <g key={e.id} onMouseEnter={() => setHover(e.id)} onMouseLeave={() => setHover(null)}>
                  <path d={`M${e.ax} ${e.ay} L${e.bx} ${e.by}`} className="topo-hit" />
                  <path d={`M${e.ax} ${e.ay} L${e.bx} ${e.by}`} className={`topo-edge topo-${statusTone(e.status)} ${on ? 'is-hover' : ''}`} />
                </g>
              )
            })}
            {edges.map((e) => hover === e.id && (
              <g key={e.id + '-lbl'} pointerEvents="none">
                <rect className="topo-lbl-bg" x={(e.ax + e.bx) / 2 - 58} y={(e.ay + e.by) / 2 - 13} width="116" height="26" rx="13" />
                <text className="topo-lbl mono" x={(e.ax + e.bx) / 2} y={(e.ay + e.by) / 2 + 4} textAnchor="middle">
                  {e.live !== undefined ? fmtRate(e.live) : e.name}
                </text>
              </g>
            ))}
            {nodes.map((n) => (
              <g key={n.id} transform={`translate(${n.x - NW / 2}, ${n.y - NH / 2})`}
                className={`topo-node ${selected === n.id ? 'is-selected' : ''} ${n.virtual ? 'is-virtual' : ''}`}
                role="button" tabIndex={0} aria-label={n.name}
                onClick={() => (n.virtual ? nav('/sessions') : setSelected(n.id))}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); n.virtual ? nav('/sessions') : setSelected(n.id) } }}>
                <rect width={NW} height={NH} rx="10" className="topo-node-box" />
                <circle cx="16" cy="18" r="4" className={`topo-dot topo-dot-${statusTone(n.status)}`} />
                <text x="28" y="22" className="topo-node-name">{n.name}</text>
                <text x="14" y="42" className="topo-node-sub mono">{n.code} · {n.sub}</text>
              </g>
            ))}
          </svg>

          <div className="topo-legend mono">
            <span><i className="lg lg-up" /> encrypted · up</span>
            <span><i className="lg lg-warn" /> rekeying</span>
            <span><i className="lg lg-down" /> down</span>
          </div>
        </div>

        <aside className="topo-detail card card-pad">
          {selSite ? (
            <>
              <div className="between" style={{ marginBottom: 'var(--sp-3)' }}>
                <StatusBadge status={selSite.status} />
                <span className="badge">{selSite.kind}</span>
              </div>
              <h2 className="topo-detail-title">{selSite.name}</h2>
              <dl className="kv-list" style={{ marginTop: 'var(--sp-3)' }}>
                <KeyVal k="Code" v={selSite.code} mono />
                <KeyVal k="Location" v={selSite.location} />
                <KeyVal k="Subnet" v={selSite.subnetCidr} mono />
                <KeyVal k="Tunnels" v={selTunnels.length} mono />
              </dl>
              <div className="topo-detail-tuns">
                <div className="section-label mono upper" style={{ marginBottom: 'var(--sp-2)' }}>Tunnels</div>
                {selTunnels.map((t) => <TunnelChip key={t.id} t={t} onClick={() => nav(`/tunnels/${t.id}`)} />)}
              </div>
              <Button variant="default" className="btn-block" onClick={() => nav(`/sites/${selSite.id}`)} style={{ marginTop: 'var(--sp-4)', width: '100%' }}>
                Open site →
              </Button>
            </>
          ) : (
            <div className="topo-empty">
              <div className="section-label mono upper">Inspector</div>
              <p className="u-muted" style={{ fontSize: 'var(--fs-sm)', marginTop: 'var(--sp-2)' }}>
                Select a node to inspect its subnets and tunnels. Hover a trace to read live throughput.
              </p>
            </div>
          )}
        </aside>
      </div>
    </>
  )
}

function TunnelChip({ t, onClick }: { t: Tunnel; onClick: () => void }) {
  return (
    <button className="tunnel-chip" onClick={onClick}>
      <span className={`dot dot-${statusTone(t.status)}`} />
      <span className="grow">{t.name}</span>
      <span className="mono u-subtle">{t.protocol}</span>
    </button>
  )
}
