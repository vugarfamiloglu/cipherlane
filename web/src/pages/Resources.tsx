import { useState } from 'react'
import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { PageHead, Loading, ErrorNote } from '../components/ui/Page'
import { DataTable, type Column } from '../components/ui/DataTable'
import { Card, Badge, Button } from '../components/ui/primitives'
import { FormModal, type Field } from '../components/ui/FormModal'
import { Icon } from '../components/ui/Icon'
import { resourceIcon } from '../lib/kinds'
import { toast } from '../components/ui/Toaster'
import { confirmDelete } from '../lib/ui'
import type { Resource, Policy } from '../lib/types'

const RES_KINDS = ['rdp', 'ssh', 'db', 'web', 'mail', 'printer', 'file', 'ad', 'erp', 'nas', 'backup']

const resourceFields = (r?: Resource): Field[] => [
  { name: 'name', label: 'Resource name', required: true, default: r?.name },
  { name: 'kind', label: 'Kind', type: 'select', default: r?.kind ?? 'web', options: RES_KINDS.map((k) => ({ value: k, label: k })) },
  { name: 'host', label: 'Host', default: r?.host, placeholder: '10.10.5.20' },
  { name: 'port', label: 'Port', default: r?.port ? String(r.port) : '', placeholder: '443' },
]
const resourcePayload = (v: Record<string, string>) => ({ name: v.name, kind: v.kind, host: v.host, port: Number(v.port) || 0 })

const policyFields = (resOpts: { value: string; label: string }[], p?: Policy): Field[] => [
  { name: 'name', label: 'Policy name', required: true, default: p?.name },
  { name: 'group', label: 'Group', required: true, default: p?.group },
  { name: 'resourceId', label: 'Resource', type: 'select', options: resOpts, default: p?.resourceId ?? resOpts[0]?.value },
  { name: 'action', label: 'Action', type: 'select', default: p?.action ?? 'allow', options: [{ value: 'allow', label: 'Allow' }, { value: 'deny', label: 'Deny' }] },
]

export function Resources() {
  const res = useResource(() => api.resources(), [])
  const pol = useResource(() => api.policies(), [])
  const [resCreate, setResCreate] = useState(false)
  const [resEdit, setResEdit] = useState<Resource | null>(null)
  const [polCreate, setPolCreate] = useState(false)
  const [polEdit, setPolEdit] = useState<Policy | null>(null)

  if (res.loading && !res.data) return <Loading label="Loading resources…" />
  if (res.error) return <ErrorNote message={res.error} onRetry={res.reload} />

  const resOpts = (res.data ?? []).map((r) => ({ value: r.id, label: `${r.name} (${r.kind})` }))

  const resCols: Column<Resource>[] = [
    { key: 'name', header: 'Resource', width: 200, render: (r) => (<div className="row gap-2"><span className="res-ic"><Icon name={resourceIcon(r.kind)} size={15} /></span><span className="cell-strong">{r.name}</span></div>) },
    { key: 'kind', header: 'Kind', width: 100, render: (r) => <Badge>{r.kind}</Badge> },
    { key: 'endpoint', header: 'Endpoint', width: 180, mono: true, render: (r) => `${r.host}:${r.port}` },
    { key: 'siteName', header: 'Site', width: 150 },
    { key: 'act', header: '', width: 92, align: 'right', render: (r) => (<div className="row-acts"><button className="row-act" title="Edit" onClick={() => setResEdit(r)}><Icon name="edit" size={15} /></button><button className="row-act danger" title="Delete" onClick={() => confirmDelete(r.name, () => api.deleteResource(r.id), res.reload)}><Icon name="trash" size={15} /></button></div>) },
  ]
  const polCols: Column<Policy>[] = [
    { key: 'name', header: 'Policy', width: 210, render: (p) => <span className="cell-strong">{p.name}</span> },
    { key: 'group', header: 'Group', width: 120 },
    { key: 'resourceName', header: 'Resource', width: 180 },
    { key: 'action', header: 'Action', width: 100, render: (p) => <Badge tone={p.action === 'allow' ? 'up' : 'down'}>{p.action}</Badge> },
    { key: 'act', header: '', width: 92, align: 'right', render: (p) => (<div className="row-acts"><button className="row-act" title="Edit" onClick={() => setPolEdit(p)}><Icon name="edit" size={15} /></button><button className="row-act danger" title="Delete" onClick={() => confirmDelete(p.name, () => api.deletePolicy(p.id), pol.reload)}><Icon name="trash" size={15} /></button></div>) },
  ]

  return (
    <>
      <PageHead title="Resources & Policies" desc="Internal assets and the rules that govern who can reach them." />

      <Card className="card-pad section-block">
        <div className="card-head"><div className="card-title">Internal resources</div><div className="row gap-2"><Badge>{res.data?.length ?? 0}</Badge><Button size="sm" variant="default" icon="plus" onClick={() => setResCreate(true)}>Add resource</Button></div></div>
        <DataTable columns={resCols} rows={res.data ?? []} empty="No resources defined."
          search={(r) => `${r.name} ${r.kind} ${r.host} ${r.siteName}`} searchPlaceholder="Search resources…" />
      </Card>

      <Card className="card-pad section-block">
        <div className="card-head"><div className="card-title">Access policies</div><div className="row gap-2"><Badge>{pol.data?.length ?? 0}</Badge><Button size="sm" variant="primary" icon="plus" onClick={() => setPolCreate(true)}>New policy</Button></div></div>
        <DataTable columns={polCols} rows={pol.data ?? []} empty="No policies defined."
          search={(p) => `${p.name} ${p.group} ${p.resourceName} ${p.action}`} searchPlaceholder="Search policies…" />
      </Card>

      {resCreate && <FormModal title="Add resource" submitLabel="Create resource" onClose={() => setResCreate(false)} onSubmit={async (v) => { await api.createResource(resourcePayload(v)); toast.success('Resource created'); res.reload() }} fields={resourceFields()} />}
      {resEdit && <FormModal title={`Edit ${resEdit.name}`} submitLabel="Save changes" onClose={() => setResEdit(null)} onSubmit={async (v) => { await api.updateResource(resEdit.id, { ...resourcePayload(v), siteId: resEdit.siteId }); toast.success('Resource updated'); res.reload() }} fields={resourceFields(resEdit)} />}
      {polCreate && <FormModal title="New policy" submitLabel="Create policy" onClose={() => setPolCreate(false)} onSubmit={async (v) => { await api.createPolicy({ name: v.name, group: v.group, resourceId: v.resourceId, action: v.action }); toast.success('Policy created'); pol.reload() }} fields={policyFields(resOpts)} />}
      {polEdit && <FormModal title={`Edit ${polEdit.name}`} submitLabel="Save changes" onClose={() => setPolEdit(null)} onSubmit={async (v) => { await api.updatePolicy(polEdit.id, { name: v.name, group: v.group, resourceId: v.resourceId, action: v.action }); toast.success('Policy updated'); pol.reload() }} fields={policyFields(resOpts, polEdit)} />}
    </>
  )
}
