import { useState } from 'react'
import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'
import { PageHead, Loading, ErrorNote } from '../components/ui/Page'
import { DataTable, type Column } from '../components/ui/DataTable'
import { StatusBadge, Badge, Button } from '../components/ui/primitives'
import { FormModal, type Field } from '../components/ui/FormModal'
import { Icon } from '../components/ui/Icon'
import { toast } from '../components/ui/Toaster'
import { confirmDelete } from '../lib/ui'
import type { Operator } from '../lib/types'

const ROLES = ['owner', 'admin', 'operator', 'auditor']

const opFields = (o?: Operator): Field[] => [
  { name: 'name', label: 'Full name', required: true, default: o?.name },
  { name: 'email', label: 'Email', required: true, default: o?.email, placeholder: 'jane@cipherlane.az' },
  { name: 'role', label: 'Role', type: 'select', default: o?.role ?? 'operator', options: ROLES.map((r) => ({ value: r, label: r })) },
  { name: 'password', label: o ? 'New password (blank = keep)' : 'Password', type: 'password', required: !o, placeholder: 'at least 6 characters' },
]

export function Team() {
  const { data, loading, error, reload } = useResource(() => api.operators(), [])
  const { canWrite } = useAuth()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Operator | null>(null)

  if (loading && !data) return <Loading label="Loading team…" />
  if (error) return <ErrorNote message={error} onRetry={reload} />

  const cols: Column<Operator>[] = [
    { key: 'status', header: 'State', width: 108, render: (o) => <StatusBadge status={o.status} /> },
    { key: 'name', header: 'Operator', width: 220, render: (o) => (<div className="row gap-2"><span className="avatar avatar-sm">{o.name.charAt(0)}</span><div><div className="cell-strong">{o.name}</div><div className="cell-sub mono">{o.email}</div></div></div>) },
    { key: 'role', header: 'Role', width: 140, render: (o) => <Badge tone={o.role === 'owner' || o.role === 'admin' ? 'up' : o.role === 'auditor' ? 'warn' : 'idle'}>{o.role}</Badge> },
    {
      key: 'act', header: '', width: 92, align: 'right', render: (o) => canWrite ? (
        <div className="row-acts">
          <button className="row-act" title="Edit" onClick={() => setEditing(o)}><Icon name="edit" size={15} /></button>
          {o.role !== 'owner' && <button className="row-act danger" title="Delete" onClick={() => confirmDelete(o.name, () => api.deleteOperator(o.id), reload)}><Icon name="trash" size={15} /></button>}
        </div>
      ) : null,
    },
  ]

  return (
    <>
      <PageHead title="Team" desc="Console operators and their access roles.">
        {canWrite && <Button variant="primary" size="sm" icon="plus" onClick={() => setCreating(true)}>Add operator</Button>}
      </PageHead>

      <div className="role-legend mono">
        <span><b>Owner / Admin</b> — full access + manage team</span>
        <span><b>Operator</b> — full access</span>
        <span><b>Auditor</b> — read-only</span>
      </div>

      <DataTable columns={cols} rows={data ?? []} empty="No operators."
        search={(o) => `${o.name} ${o.email} ${o.role} ${o.status}`} searchPlaceholder="Search operators…" />

      {creating && <FormModal title="Add operator" submitLabel="Create operator" onClose={() => setCreating(false)} onSubmit={async (v) => { await api.createOperator(v); toast.success('Operator created'); reload() }} fields={opFields()} />}
      {editing && <FormModal title={`Edit ${editing.name}`} submitLabel="Save changes" onClose={() => setEditing(null)} onSubmit={async (v) => { await api.updateOperator(editing.id, v); toast.success('Operator updated'); reload() }} fields={opFields(editing)} />}
    </>
  )
}
