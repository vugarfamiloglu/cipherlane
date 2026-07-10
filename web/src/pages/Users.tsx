import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { PageHead, Loading, ErrorNote } from '../components/ui/Page'
import { DataTable, type Column } from '../components/ui/DataTable'
import { StatusBadge, Badge, Button } from '../components/ui/primitives'
import { toast } from '../components/ui/Toaster'
import type { User } from '../lib/types'

export function Users() {
  const { data, loading, error, reload } = useResource(() => api.users(), [])
  const nav = useNavigate()
  if (loading && !data) return <Loading label="Loading users…" />
  if (error) return <ErrorNote message={error} onRetry={reload} />

  const cols: Column<User>[] = [
    { key: 'status', header: 'State', width: 112, render: (u) => <StatusBadge status={u.status} /> },
    { key: 'name', header: 'User', width: 220, render: (u) => (<div className="row gap-2"><span className="avatar avatar-sm">{u.name.charAt(0)}</span><div><div className="cell-strong">{u.name}</div><div className="cell-sub mono">@{u.username}</div></div></div>) },
    { key: 'role', header: 'Role', width: 120, render: (u) => <Badge>{u.role}</Badge> },
    { key: 'group', header: 'Group', width: 130 },
    { key: 'tunnelMode', header: 'Tunnel', width: 110, render: (u) => <span className="mono">{u.tunnelMode}</span> },
    { key: 'mfaEnabled', header: 'MFA', width: 92, align: 'center', render: (u) => <span className={`sbadge sbadge-${u.mfaEnabled ? 'up' : 'idle'}`}><span className="sbadge-dot" />{u.mfaEnabled ? 'on' : 'off'}</span> },
    { key: 'corporateIp', header: 'Corp IP', width: 140, mono: true },
  ]

  return (
    <>
      <PageHead title="Users" desc="Remote-access accounts, devices, and their live sessions.">
        <Button variant="primary" size="sm" icon="plus" onClick={() => toast.info('Create-user flow opens here')}>Add user</Button>
      </PageHead>
      <DataTable columns={cols} rows={data ?? []} onRowClick={(u) => nav(`/users/${u.id}`)} empty="No users yet." />
    </>
  )
}
