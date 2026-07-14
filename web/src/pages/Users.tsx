import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { PageHead, Loading, ErrorNote } from '../components/ui/Page'
import { DataTable, type Column } from '../components/ui/DataTable'
import { StatusBadge, Badge, Button } from '../components/ui/primitives'
import { FormModal, type Field } from '../components/ui/FormModal'
import { Icon } from '../components/ui/Icon'
import { toast } from '../components/ui/Toaster'
import { confirmDelete, errMsg } from '../lib/ui'
import type { User } from '../lib/types'

export const userFields = (u?: User): Field[] => [
  { name: 'name', label: 'Full name', required: true, default: u?.name },
  { name: 'username', label: 'Username', required: true, default: u?.username, placeholder: 'e.g. jane.doe' },
  { name: 'email', label: 'Email', default: u?.email },
  { name: 'role', label: 'Role', type: 'select', default: u?.role ?? 'member', options: ['member', 'operator', 'admin', 'auditor'].map((v) => ({ value: v, label: v })) },
  { name: 'group', label: 'Group', default: u?.group, placeholder: 'e.g. NetOps' },
  { name: 'tunnelMode', label: 'Tunnel mode', type: 'select', default: u?.tunnelMode ?? 'split', options: [{ value: 'split', label: 'Split tunnel' }, { value: 'full', label: 'Full tunnel' }] },
  { name: 'corporateIp', label: 'Corporate IP', default: u?.corporateIp, placeholder: '10.10.200.x' },
  { name: 'mfa', label: 'MFA', type: 'select', default: u?.mfaEnabled ? 'on' : 'off', options: [{ value: 'off', label: 'Off' }, { value: 'on', label: 'Enforced' }] },
]

export const userPayload = (v: Record<string, string>) => ({
  name: v.name, username: v.username, email: v.email, role: v.role,
  group: v.group, tunnelMode: v.tunnelMode, corporateIp: v.corporateIp, mfaEnabled: v.mfa === 'on',
})

export function Users() {
  const { data, loading, error, reload } = useResource(() => api.users(), [])
  const nav = useNavigate()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)

  if (loading && !data) return <Loading label="Loading users…" />
  if (error) return <ErrorNote message={error} onRetry={reload} />

  const suspend = async (u: User) => {
    try { const r = await api.suspendUser(u.id); toast.success(`User ${r.status}`); reload() } catch (e) { toast.error(errMsg(e)) }
  }

  const cols: Column<User>[] = [
    { key: 'status', header: 'State', width: 108, render: (u) => <StatusBadge status={u.status} /> },
    { key: 'name', header: 'User', width: 210, render: (u) => (<div className="row gap-2"><span className="avatar avatar-sm">{u.name.charAt(0)}</span><div><div className="cell-strong">{u.name}</div><div className="cell-sub mono">@{u.username}</div></div></div>) },
    { key: 'role', header: 'Role', width: 110, render: (u) => <Badge>{u.role}</Badge> },
    { key: 'group', header: 'Group', width: 120 },
    { key: 'tunnelMode', header: 'Tunnel', width: 96, render: (u) => <span className="mono">{u.tunnelMode}</span> },
    { key: 'mfaEnabled', header: 'MFA', width: 84, align: 'center', render: (u) => <span className={`sbadge sbadge-${u.mfaEnabled ? 'up' : 'idle'}`}><span className="sbadge-dot" />{u.mfaEnabled ? 'on' : 'off'}</span> },
    {
      key: 'act', header: '', width: 122, align: 'right', render: (u) => (
        <div className="row-acts" onClick={(e) => e.stopPropagation()}>
          <button className="row-act" title={u.status === 'active' ? 'Suspend' : 'Activate'} onClick={() => suspend(u)}><Icon name="power" size={15} /></button>
          <button className="row-act" title="Edit" onClick={() => setEditing(u)}><Icon name="edit" size={15} /></button>
          <button className="row-act danger" title="Delete" onClick={() => confirmDelete(u.name, () => api.deleteUser(u.id), reload)}><Icon name="trash" size={15} /></button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHead title="Users" desc="Remote-access accounts, devices, and their live sessions.">
        <Button variant="primary" size="sm" icon="plus" onClick={() => setCreating(true)}>Add user</Button>
      </PageHead>
      <DataTable columns={cols} rows={data ?? []} onRowClick={(u) => nav(`/users/${u.id}`)} empty="No users yet."
        search={(u) => `${u.name} ${u.email} ${u.username} ${u.role} ${u.group} ${u.status}`} searchPlaceholder="Search users…" />

      {creating && (
        <FormModal title="Add user" submitLabel="Create user" onClose={() => setCreating(false)}
          onSubmit={async (v) => { await api.createUser(userPayload(v)); toast.success('User created'); reload() }}
          fields={userFields()} />
      )}
      {editing && (
        <FormModal title={`Edit ${editing.name}`} submitLabel="Save changes" onClose={() => setEditing(null)}
          onSubmit={async (v) => { await api.updateUser(editing.id, userPayload(v)); toast.success('User updated'); reload() }}
          fields={userFields(editing)} />
      )}
    </>
  )
}
