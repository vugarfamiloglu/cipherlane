import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { useLive } from '../lib/live'
import { PageHead, Loading, ErrorNote } from '../components/ui/Page'
import { DataTable, type Column } from '../components/ui/DataTable'
import { StatusBadge, Badge, Button } from '../components/ui/primitives'
import { FormModal } from '../components/ui/FormModal'
import { Sparkline } from '../components/ui/Sparkline'
import { Icon } from '../components/ui/Icon'
import { fmtRate } from '../lib/format'
import { toast } from '../components/ui/Toaster'
import { confirmDelete, errMsg } from '../lib/ui'
import type { Tunnel } from '../lib/types'

export function Tunnels() {
  const { data, loading, error, reload } = useResource(() => api.tunnels(), [])
  const sites = useResource(() => api.sites(), [])
  const { telemetry } = useLive()
  const nav = useNavigate()
  const [wizard, setWizard] = useState(false)

  if (loading && !data) return <Loading label="Loading tunnels…" />
  if (error) return <ErrorNote message={error} onRetry={reload} />

  const live = (t: Tunnel) => telemetry?.tunnels[t.id] ?? t.live
  const siteOpts = (sites.data ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.subnetCidr})` }))

  const toggle = async (t: Tunnel) => {
    try { const r = await api.toggleTunnel(t.id); toast.success(`Tunnel ${r.status === 'down' ? 'disabled' : 'enabled'}`); reload() } catch (e) { toast.error(errMsg(e)) }
  }

  const cols: Column<Tunnel>[] = [
    { key: 'status', header: 'State', width: 118, render: (t) => <StatusBadge status={live(t)?.status ?? t.status} /> },
    { key: 'name', header: 'Tunnel', width: 230, render: (t) => (<div><div className="cell-strong">{t.name}</div><div className="cell-sub mono">{t.aSiteName} ⇄ {t.bSiteName}</div></div>) },
    { key: 'protocol', header: 'Protocol', width: 116, render: (t) => <Badge>{t.protocol}</Badge> },
    { key: 'cipher', header: 'Cipher', width: 176, mono: true, render: (t) => t.cipher },
    { key: 'rate', header: 'Throughput', width: 128, align: 'right', render: (t) => { const l = live(t); return <span className="mono tnum">{l ? fmtRate(l.rxMbps + l.txMbps) : '–'}</span> } },
    { key: 'trend', header: 'Trend', width: 108, render: (t) => { const l = live(t); return <Sparkline data={l?.history ?? []} width={88} height={22} stroke={(l?.status ?? t.status) === 'rekeying' ? 'var(--warn-500)' : 'var(--primary)'} /> } },
    { key: 'lat', header: 'Latency', width: 104, align: 'right', render: (t) => { const l = live(t); return <span className="mono tnum">{l ? `${l.latencyMs.toFixed(0)} ms` : '–'}</span> } },
    { key: 'routing', header: 'Routing', width: 100, mono: true, render: (t) => t.routing },
    { key: 'alwaysOn', header: 'Always-on', width: 100, align: 'center', render: (t) => <span className={`dot dot-${t.alwaysOn ? 'up' : 'idle'}`} /> },
    { key: 'act', header: '', width: 92, align: 'right', render: (t) => (<div className="row-acts" onClick={(e) => e.stopPropagation()}><button className="row-act" title={(live(t)?.status ?? t.status) === 'down' ? 'Enable' : 'Disable'} onClick={() => toggle(t)}><Icon name="power" size={15} /></button><button className="row-act danger" title="Delete" onClick={() => confirmDelete(t.name, () => api.deleteTunnel(t.id), reload)}><Icon name="trash" size={15} /></button></div>) },
  ]

  return (
    <>
      <PageHead title="Tunnels" desc="Encrypted site-to-site links across the estate.">
        <Button variant="primary" size="sm" icon="plus" onClick={() => setWizard(true)}>New tunnel</Button>
      </PageHead>
      <DataTable columns={cols} rows={data ?? []} onRowClick={(t) => nav(`/tunnels/${t.id}`)} empty="No tunnels configured yet." />

      {wizard && (
        <FormModal
          title="New tunnel"
          submitLabel="Create tunnel"
          onClose={() => setWizard(false)}
          onSubmit={async (v) => {
            await api.createTunnel({
              name: v.name, aSiteId: v.aSiteId, bSiteId: v.bSiteId,
              protocol: v.protocol, routing: v.routing,
            })
            toast.success('Tunnel created')
            reload()
          }}
          fields={[
            { name: 'name', label: 'Tunnel name', placeholder: 'e.g. HQ ⇄ Warehouse', required: true },
            { name: 'aSiteId', label: 'Endpoint A', type: 'select', options: siteOpts, default: siteOpts[0]?.value, required: true },
            { name: 'bSiteId', label: 'Endpoint B', type: 'select', options: siteOpts, default: siteOpts[1]?.value, required: true },
            { name: 'protocol', label: 'Protocol', type: 'select', options: [{ value: 'wireguard', label: 'WireGuard' }, { value: 'ipsec', label: 'IPsec / IKEv2' }] },
            { name: 'routing', label: 'Routing', type: 'select', options: [{ value: 'static', label: 'Static' }, { value: 'bgp', label: 'BGP' }, { value: 'ospf', label: 'OSPF' }] },
          ]}
        />
      )}
    </>
  )
}
