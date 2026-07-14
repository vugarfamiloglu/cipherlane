import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { useLive } from '../lib/live'
import { usePageHeader } from '../components/shell/AppShell'
import { Loading, ErrorNote, StatTile } from '../components/ui/Page'
import { Card, Button, StatusBadge, Badge, KeyVal } from '../components/ui/primitives'
import { Icon } from '../components/ui/Icon'
import { Sparkline } from '../components/ui/Sparkline'
import { fmtRate } from '../lib/format'
import { toast } from '../components/ui/Toaster'
import type { Tunnel } from '../lib/types'

export function TunnelDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { data, loading, error, reload } = useResource(() => api.tunnel(id!), [id])
  const { telemetry } = useLive()
  usePageHeader('SITE-TO-SITE', data?.name, data ? `${data.aSiteName} ⇄ ${data.bSiteName}` : undefined)

  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorNote message={error ?? 'Tunnel not found'} onRetry={reload} />

  const l = telemetry?.tunnels[data.id] ?? data.live
  const cfg = buildConfig(data)

  return (
    <>
      <button className="back-link" onClick={() => nav('/tunnels')}>
        <Icon name="chevronRight" size={14} style={{ transform: 'rotate(180deg)' }} /> Tunnels
      </button>

      <div className="kpi-grid">
        <StatTile index={0} label="State" value={<StatusBadge status={l?.status ?? data.status} />} />
        <StatTile index={1} label="Throughput" value={l ? fmtRate(l.rxMbps + l.txMbps) : '–'} icon="signal" />
        <StatTile index={2} label="Latency" value={l ? l.latencyMs.toFixed(0) : '–'} unit="ms" />
        <StatTile index={3} label="Packet loss" value={l ? l.lossPct.toFixed(2) : '–'} unit="%" tone={l && l.lossPct > 1 ? 'warn' : undefined} />
      </div>

      <div className="ov-grid ov-grid-a">
        <Card className="ov-panel">
          <div className="card-head"><div className="card-title">Configuration</div><Badge>{data.protocol}</Badge></div>
          <dl className="kv-list">
            <KeyVal k="Endpoint A" v={data.aSiteName} />
            <KeyVal k="Endpoint B" v={data.bSiteName} />
            <KeyVal k="Cipher" v={data.cipher} mono />
            <KeyVal k="Auth method" v={data.authMethod} mono />
            <KeyVal k="Routing" v={data.routing} mono />
            <KeyVal k="MTU" v={data.mtu} mono />
            <KeyVal k="Always-on" v={data.alwaysOn ? 'Enabled' : 'Off'} />
          </dl>
        </Card>

        <Card className="ov-panel">
          <div className="card-head"><div className="card-title">Live session</div></div>
          <div className="tunnel-spark">
            <Sparkline data={l?.history ?? []} width={280} height={44} stroke={(l?.status ?? data.status) === 'rekeying' ? 'var(--warn-500)' : 'var(--primary)'} />
          </div>
          <dl className="kv-list">
            <KeyVal k="Rx" v={l ? fmtRate(l.rxMbps) : '–'} mono />
            <KeyVal k="Tx" v={l ? fmtRate(l.txMbps) : '–'} mono />
            <KeyVal k="Handshake age" v={l ? `${l.handshakeAgeS}s` : '–'} mono />
            <KeyVal k="Rekey in" v={l ? `${l.rekeyInS}s` : '–'} mono />
          </dl>
          <div className="section-label mono upper" style={{ margin: 'var(--sp-4) 0 var(--sp-2)' }}>Advertised routes</div>
          {(data.routes ?? []).map((r) => (
            <div key={r.id} className="route-row mono"><Icon name="route" size={14} /><span className="grow">{r.cidr}</span><Badge>{r.kind}</Badge></div>
          ))}
          {!data.routes?.length && <div className="u-muted mono" style={{ fontSize: 'var(--fs-xs)' }}>No advertised routes.</div>}
        </Card>
      </div>

      <Card className="card-pad" style={{ marginTop: 'var(--sp-5)' }}>
        <div className="card-head">
          <div className="card-title">Generated {data.protocol} config</div>
          <Button size="sm" icon="copy" onClick={() => { navigator.clipboard?.writeText(cfg); toast.success('Config copied to clipboard') }}>Copy</Button>
        </div>
        <pre className="codeblock mono">{cfg}</pre>
      </Card>
    </>
  )
}

function buildConfig(t: Tunnel): string {
  const allowed = (t.routes ?? []).map((r) => r.cidr).join(', ') || '0.0.0.0/0'
  if (t.protocol === 'wireguard') {
    return [
      '[Interface]',
      `# ${t.aSiteName} gateway`,
      'PrivateKey = <sealed-in-vault>',
      'Address    = 10.255.0.1/32',
      `MTU        = ${t.mtu}`,
      '',
      '[Peer]',
      `# ${t.bSiteName} gateway`,
      'PublicKey  = <peer-public-key>',
      `AllowedIPs = ${allowed}`,
      'PersistentKeepalive = 25',
    ].join('\n')
  }
  return [
    `conn ${t.name.replace(/\s+/g, '-').toLowerCase()}`,
    '  keyexchange = ikev2',
    '  ike  = aes256-sha256-modp2048',
    `  esp  = ${t.cipher}`,
    `  left = ${t.aSiteName}`,
    `  right = ${t.bSiteName}`,
    `  authby = ${t.authMethod}`,
    `  rightsubnet = ${allowed}`,
    '  auto = start',
  ].join('\n')
}
