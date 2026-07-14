import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { useLive } from '../lib/live'
import { PageHead, Loading, ErrorNote } from '../components/ui/Page'
import { Button, StatusBadge, KeyVal, statusTone } from '../components/ui/primitives'
import { toast } from '../components/ui/Toaster'
import { exportSvgToPng } from '../lib/svgExport'
import { fmtRate } from '../lib/format'
import type { Tunnel } from '../lib/types'

type Pos = Record<string, { x: number; y: number }>
const posKey = (l: Layout) => `cl-topo-pos-${l}`
function loadPos(l: Layout): Pos {
  try { return JSON.parse(localStorage.getItem(posKey(l)) || '{}') as Pos } catch { return {} }
}

const W = 960, H = 600, CX = 480, CY = 300
const NW = 150, NH = 56, HW = NW / 2, HH = NH / 2, GAP = 4

type Layout = 'radial' | 'ring' | 'grid' | 'layered'
const LAYOUTS: { key: Layout; label: string }[] = [
  { key: 'radial', label: 'Radial' },
  { key: 'ring', label: 'Ring' },
  { key: 'grid', label: 'Grid' },
  { key: 'layered', label: 'Layered' },
]

interface Node { id: string; name: string; code: string; sub: string; kind: string; status: string; x: number; y: number; virtual?: boolean }

// Point where the segment center->target exits a node's (padded) box rim, so
// edges stop at the box boundary and never draw over a node.
function rim(cx: number, cy: number, tx: number, ty: number): { x: number; y: number } {
  const dx = tx - cx, dy = ty - cy
  if (!dx && !dy) return { x: cx, y: cy }
  const t = Math.min(dx ? (HW + GAP) / Math.abs(dx) : Infinity, dy ? (HH + GAP) / Math.abs(dy) : Infinity)
  return { x: cx + dx * t, y: cy + dy * t }
}

function place(items: Omit<Node, 'x' | 'y'>[], layout: Layout): Node[] {
  const n = items.length
  if (!n) return []
  if (layout === 'ring') {
    return items.map((it, i) => {
      const a = (-90 + (i * 360) / n) * (Math.PI / 180)
      return { ...it, x: CX + 205 * Math.cos(a), y: CY + 205 * Math.sin(a) }
    })
  }
  if (layout === 'grid') {
    const cols = Math.ceil(Math.sqrt(n))
    const rows = Math.ceil(n / cols)
    const mx = 150, my = 130
    const cw = (W - 2 * mx) / Math.max(1, cols - 1 || 1)
    const ch = (H - 2 * my) / Math.max(1, rows - 1 || 1)
    return items.map((it, i) => {
      const c = i % cols, r = Math.floor(i / cols)
      return { ...it, x: cols === 1 ? CX : mx + c * cw, y: rows === 1 ? CY : my + r * ch }
    })
  }
  if (layout === 'layered') {
    const tierOf = (k: string) => (k === 'hq' || k === 'datacenter' ? 0 : k === 'branch' ? 1 : 2)
    const ys = [140, 315, 480]
    const tiers: Omit<Node, 'x' | 'y'>[][] = [[], [], []]
    items.forEach((it) => tiers[tierOf(it.kind)].push(it))
    const out: Node[] = []
    tiers.forEach((row, ti) => {
      const m = row.length
      row.forEach((it, i) => {
        const x = m === 1 ? CX : 170 + (i * (W - 340)) / (m - 1)
        out.push({ ...it, x, y: ys[ti] })
      })
    })
    return out
  }
  // radial (hub + spokes)
  const hub = items.find((s) => s.kind === 'hq') ?? items[0]
  const ring = items.filter((s) => s.id !== hub.id)
  const out: Node[] = [{ ...hub, x: CX, y: CY }]
  ring.forEach((it, i) => {
    const a = (-90 + (i * 360) / ring.length) * (Math.PI / 180)
    out.push({ ...it, x: CX + 210 * Math.cos(a), y: CY + 210 * Math.sin(a) })
  })
  return out
}

export function Topology() {
  const sitesR = useResource(() => api.sites(), [])
  const tunsR = useResource(() => api.tunnels(), [])
  const sessR = useResource(() => api.sessions(), [])
  const { telemetry } = useLive()
  const nav = useNavigate()
  const [selected, setSelected] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [layout, setLayout] = useState<Layout>(() => (localStorage.getItem('cl-topo') as Layout) || 'radial')
  const svgRef = useRef<SVGSVGElement>(null)
  const [pos, setPos] = useState<Pos>(() => loadPos((localStorage.getItem('cl-topo') as Layout) || 'radial'))
  const drag = useRef<{ id: string; moved: boolean } | null>(null)

  const online = telemetry?.global.onlineSessions ?? sessR.data?.filter((s) => s.status === 'connected').length ?? 0

  const nodes = useMemo(() => {
    const sites = sitesR.data ?? []
    if (!sites.length) return []
    const items = sites.map((s) => ({ id: s.id, name: s.name, code: s.code, sub: s.subnetCidr, kind: s.kind, status: s.status }))
    items.push({ id: '__remote__', name: 'Remote Workforce', code: 'RA', sub: `${online} online`, kind: 'remote', status: online > 0 ? 'online' : 'idle' })
    const placed = place(items.map((it) => ({ ...it, virtual: it.id === '__remote__' })), layout)
    return placed.map((nd) => (pos[nd.id] ? { ...nd, x: pos[nd.id].x, y: pos[nd.id].y } : nd))
  }, [sitesR.data, online, layout, pos])

  const posOf = (id: string) => nodes.find((nd) => nd.id === id)

  const edges = useMemo(() => {
    const list: { id: string; name: string; ax: number; ay: number; bx: number; by: number; status: string; live?: number }[] = []
    for (const t of tunsR.data ?? []) {
      const a = posOf(t.aSiteId), b = posOf(t.bSiteId)
      if (!a || !b) continue
      const s = rim(a.x, a.y, b.x, b.y), e = rim(b.x, b.y, a.x, a.y)
      const live = telemetry?.tunnels[t.id]
      list.push({ id: t.id, name: t.name, ax: s.x, ay: s.y, bx: e.x, by: e.y, status: live?.status ?? t.status, live: live ? live.rxMbps + live.txMbps : undefined })
    }
    const hub = nodes.find((nd) => nd.kind === 'hq') ?? nodes[0]
    const remote = posOf('__remote__')
    if (hub && remote) {
      const s = rim(hub.x, hub.y, remote.x, remote.y), e = rim(remote.x, remote.y, hub.x, hub.y)
      list.push({ id: '__ra__', name: 'Remote access', ax: s.x, ay: s.y, bx: e.x, by: e.y, status: online > 0 ? 'up' : 'idle' })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tunsR.data, nodes, telemetry, online])

  if (sitesR.loading && !sitesR.data) return <Loading label="Mapping topology…" />
  if (sitesR.error) return <ErrorNote message={sitesR.error} onRetry={sitesR.reload} />

  const pickLayout = (l: Layout) => { setLayout(l); localStorage.setItem('cl-topo', l); setPos(loadPos(l)) }

  const toSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return null
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }
  const onNodeDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    drag.current = { id, moved: false }
  }
  const onNodeMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const p = toSvg(e.clientX, e.clientY)
    if (!p) return
    d.moved = true
    const x = Math.max(HW + GAP, Math.min(W - HW - GAP, p.x))
    const y = Math.max(HH + GAP, Math.min(H - HH - GAP, p.y))
    setPos((cur) => ({ ...cur, [d.id]: { x, y } }))
  }
  const onNodeUp = (nd: Node) => {
    const d = drag.current
    drag.current = null
    if (d && d.moved) setPos((cur) => { localStorage.setItem(posKey(layout), JSON.stringify(cur)); return cur })
    else if (nd.virtual) nav('/sessions')
    else setSelected(nd.id)
  }
  const resetLayout = () => { setPos({}); localStorage.removeItem(posKey(layout)); toast.info('Layout reset to default') }
  const exportPng = async () => {
    if (!svgRef.current) return
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#ffffff'
    try { await exportSvgToPng(svgRef.current, 'cipherlane-topology.png', bg); toast.success('Topology exported as PNG') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Export failed') }
  }

  const selSite = (sitesR.data ?? []).find((s) => s.id === selected)
  const selTunnels = (tunsR.data ?? []).filter((t) => t.aSiteId === selected || t.bSiteId === selected)

  return (
    <>
      <PageHead title="Network Topology" desc="Every site, encrypted tunnel, and the remote-access mesh — live.">
        <div className="seg" role="tablist" aria-label="Topology layout">
          {LAYOUTS.map((l) => (
            <button key={l.key} role="tab" aria-selected={layout === l.key}
              className={`seg-btn mono ${layout === l.key ? 'is-on' : ''}`} onClick={() => pickLayout(l.key)}>
              {l.label}
            </button>
          ))}
        </div>
        <Button size="sm" variant="ghost" icon="refresh" onClick={resetLayout}>Reset</Button>
        <Button size="sm" variant="default" icon="download" onClick={exportPng}>PNG</Button>
      </PageHead>

      <div className="topo-layout">
        <div className="card topo-canvas grid-bg">
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="topo-svg" role="img" aria-label="Network topology map">
            {edges.map((e) => (
              <g key={e.id} onMouseEnter={() => setHover(e.id)} onMouseLeave={() => setHover(null)}>
                <path d={`M${e.ax} ${e.ay} L${e.bx} ${e.by}`} className="topo-hit" />
                <path d={`M${e.ax} ${e.ay} L${e.bx} ${e.by}`} className={`topo-edge topo-${statusTone(e.status)} ${hover === e.id ? 'is-hover' : ''}`} />
              </g>
            ))}
            {edges.map((e) => hover === e.id && (
              <g key={e.id + '-lbl'} pointerEvents="none">
                <rect className="topo-lbl-bg" x={(e.ax + e.bx) / 2 - 58} y={(e.ay + e.by) / 2 - 13} width="116" height="26" rx="13" />
                <text className="topo-lbl mono" x={(e.ax + e.bx) / 2} y={(e.ay + e.by) / 2 + 4} textAnchor="middle">
                  {e.live !== undefined ? fmtRate(e.live) : e.name}
                </text>
              </g>
            ))}
            {nodes.map((nd) => (
              <g key={nd.id} transform={`translate(${nd.x - HW}, ${nd.y - HH})`}
                className={`topo-node ${selected === nd.id ? 'is-selected' : ''} ${nd.virtual ? 'is-virtual' : ''}`}
                role="button" tabIndex={0} aria-label={nd.name}
                onPointerDown={(e) => onNodeDown(e, nd.id)}
                onPointerMove={onNodeMove}
                onPointerUp={() => onNodeUp(nd)}
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); nd.virtual ? nav('/sessions') : setSelected(nd.id) } }}>
                <rect width={NW} height={NH} rx="10" className="topo-node-box" />
                <circle cx="16" cy="18" r="4" className={`topo-dot topo-dot-${statusTone(nd.status)}`} />
                <text x="28" y="22" className="topo-node-name">{nd.name}</text>
                <text x="14" y="42" className="topo-node-sub mono">{nd.code} · {nd.sub}</text>
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
              <Button variant="default" onClick={() => nav(`/sites/${selSite.id}`)} style={{ marginTop: 'var(--sp-4)', width: '100%' }}>
                Open site →
              </Button>
            </>
          ) : (
            <div className="topo-empty">
              <div className="section-label mono upper">Inspector</div>
              <p className="u-muted" style={{ fontSize: 'var(--fs-sm)', marginTop: 'var(--sp-2)' }}>
                Select a node to inspect its subnets and tunnels. Hover a trace to read live throughput. Switch the layout above.
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
