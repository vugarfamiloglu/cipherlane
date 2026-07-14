import { useState } from 'react'
import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { PageHead, Loading, ErrorNote } from '../components/ui/Page'
import { DataTable, type Column } from '../components/ui/DataTable'
import { StatusBadge, Badge, Button } from '../components/ui/primitives'
import { FormModal, type Field } from '../components/ui/FormModal'
import { Icon } from '../components/ui/Icon'
import { confirmModal } from '../components/ui/Modal'
import { timeAgo } from '../lib/format'
import { toast } from '../components/ui/Toaster'
import { confirmDelete, errMsg } from '../lib/ui'
import type { Gateway } from '../lib/types'

const gatewayFields = (siteOpts: { value: string; label: string }[], g?: Gateway): Field[] => [
  { name: 'name', label: 'Gateway name', required: true, default: g?.name, placeholder: 'hq-gw-02' },
  { name: 'siteId', label: 'Site', type: 'select', options: siteOpts, default: g?.siteId ?? siteOpts[0]?.value, required: true },
  { name: 'endpoint', label: 'Endpoint', default: g?.endpoint, placeholder: 'vpn.example:51820' },
  { name: 'wanIp', label: 'WAN IP', default: g?.wanIp, placeholder: '91.203.10.4' },
  { name: 'protocol', label: 'Protocol', type: 'select', default: g?.protocol ?? 'wireguard', options: [{ value: 'wireguard', label: 'WireGuard' }, { value: 'ipsec', label: 'IPsec' }] },
  { name: 'version', label: 'Version', default: g?.version },
]

export function Gateways() {
  const { data, loading, error, reload } = useResource(() => api.gateways(), [])
  const sites = useResource(() => api.sites(), [])
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Gateway | null>(null)

  if (loading && !data) return <Loading label="Loading gateways…" />
  if (error) return <ErrorNote message={error} onRetry={reload} />

  const siteOpts = (sites.data ?? []).map((s) => ({ value: s.id, label: s.name }))

  const rotate = async (g: Gateway) => {
    const ok = await confirmModal({ title: `Rotate key for ${g.name}?`, message: 'Generates a fresh WireGuard key pair and seals it in the vault.', confirmText: 'Rotate' })
    if (!ok) return
    try { await api.rotateGateway(g.id); toast.success('Gateway key rotated'); reload() } catch (e) { toast.error(errMsg(e)) }
  }

  const cols: Column<Gateway>[] = [
    { key: 'status', header: 'State', width: 116, render: (g) => <StatusBadge status={g.status} /> },
    { key: 'name', header: 'Gateway', width: 170, render: (g) => <span className="cell-strong mono">{g.name}</span> },
    { key: 'siteName', header: 'Site', width: 160 },
    { key: 'endpoint', header: 'Endpoint', width: 210, mono: true },
    { key: 'protocol', header: 'Protocol', width: 116, render: (g) => <Badge>{g.protocol}</Badge> },
    { key: 'version', header: 'Version', width: 150, mono: true },
    { key: 'lastSeen', header: 'Last seen', width: 110, align: 'right', render: (g) => <span className="mono u-muted">{timeAgo(g.lastSeen)}</span> },
    { key: 'act', header: '', width: 118, align: 'right', render: (g) => (<div className="row-acts"><button className="row-act" title="Rotate key" onClick={() => rotate(g)}><Icon name="key" size={15} /></button><button className="row-act" title="Edit" onClick={() => setEditing(g)}><Icon name="edit" size={15} /></button><button className="row-act danger" title="Delete" onClick={() => confirmDelete(g.name, () => api.deleteGateway(g.id), reload)}><Icon name="trash" size={15} /></button></div>) },
  ]

  return (
    <>
      <PageHead title="Gateways" desc="The router and firewall endpoints that terminate tunnels.">
        <Button variant="primary" size="sm" icon="plus" onClick={() => setCreating(true)}>Add gateway</Button>
      </PageHead>
      <DataTable columns={cols} rows={data ?? []} empty="No gateways registered." />

      {creating && <FormModal title="Add gateway" submitLabel="Create gateway" onClose={() => setCreating(false)} onSubmit={async (v) => { await api.createGateway(v); toast.success('Gateway created'); reload() }} fields={gatewayFields(siteOpts)} />}
      {editing && <FormModal title={`Edit ${editing.name}`} submitLabel="Save changes" onClose={() => setEditing(null)} onSubmit={async (v) => { await api.updateGateway(editing.id, v); toast.success('Gateway updated'); reload() }} fields={gatewayFields(siteOpts, editing)} />}
    </>
  )
}
