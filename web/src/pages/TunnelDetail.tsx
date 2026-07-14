import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { useLive } from '../lib/live'
import { usePageHeader } from '../components/shell/AppShell'
import { Loading, ErrorNote, StatTile } from '../components/ui/Page'
import { Card, Button, StatusBadge, Badge, KeyVal } from '../components/ui/primitives'
import { FormModal } from '../components/ui/FormModal'
import { Icon } from '../components/ui/Icon'
import { Sparkline } from '../components/ui/Sparkline'
import { fmtRate } from '../lib/format'
import { toast } from '../components/ui/Toaster'
import { confirmDelete, errMsg } from '../lib/ui'
import type { Tunnel } from '../lib/types'

export function TunnelDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { data, loading, error, reload } = useResource(() => api.tunnel(id!), [id])
  const { telemetry } = useLive()
  usePageHeader('SITE-TO-SITE', data?.name, data ? `${data.aSiteName} ⇄ ${data.bSiteName}` : undefined)
  const [editing, setEditing] = useState(false)

  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorNote message={error ?? 'Tunnel not found'} onRetry={reload} />

  const l = telemetry?.tunnels[data.id] ?? data.live
  const cfg = buildConfig(data)
  const disabled = (l?.status ?? data.status) === 'down'

  const toggle = async () => {
    try { const r = await api.toggleTunnel(data.id); toast.success(`Tunnel ${r.status === 'down' ? 'disabled' : 'enabled'}`); reload() } catch (e) { toast.error(errMsg(e)) }
  }

  return (
    <>
      <div className="between detail-topbar">
        <button className="back-link" style={{ marginBottom: 0 }} onClick={() => nav('/tunnels')}>
          <Icon name="chevronRight" size={14} style={{ transform: 'rotate(180deg)' }} /> Tunnels
        </button>
        <div className="detail-actions">
          <Button variant="default" size="sm" icon="power" onClick={toggle}>{disabled ? 'Enable' : 'Disable'}</Button>
          <Button variant="default" size="sm" icon="edit" onClick={() => setEditing(true)}>Edit</Button>
          <Button variant="danger" size="sm" icon="trash" onClick={() => confirmDelete(data.name, () => api.deleteTunnel(data.id), () => nav('/tunnels'))}>Delete</Button>
        </div>
      </div>

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

      {editing && (
        <FormModal title={`Edit ${data.name}`} submitLabel="Save changes" onClose={() => setEditing(false)}
          onSubmit={async (v) => {
            await api.updateTunnel(data.id, { name: v.name, protocol: v.protocol, cipher: v.cipher, authMethod: v.authMethod, routing: v.routing, mtu: Number(v.mtu) || 1420, status: data.status })
            toast.success('Tunnel updated'); reload()
          }}
          fields={[
            { name: 'name', label: 'Tunnel name', required: true, default: data.name },
            { name: 'protocol', label: 'Protocol', type: 'select', default: data.protocol, options: [{ value: 'wireguard', label: 'WireGuard' }, { value: 'ipsec', label: 'IPsec' }] },
            { name: 'cipher', label: 'Cipher', default: data.cipher },
            { name: 'authMethod', label: 'Auth', type: 'select', default: data.authMethod, options: [{ value: 'psk', label: 'Pre-shared key' }, { value: 'certificate', label: 'Certificate' }] },
            { name: 'routing', label: 'Routing', type: 'select', default: data.routing, options: [{ value: 'static', label: 'Static' }, { value: 'bgp', label: 'BGP' }, { value: 'ospf', label: 'OSPF' }] },
            { name: 'mtu', label: 'MTU', default: String(data.mtu) },
          ]} />
      )}
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
