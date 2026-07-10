import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { useLive } from '../lib/live'
import { PageHead, Loading, ErrorNote } from '../components/ui/Page'
import { DataTable, type Column } from '../components/ui/DataTable'
import { StatusBadge, Button } from '../components/ui/primitives'
import { fmtRate, duration } from '../lib/format'
import { confirmModal } from '../components/ui/Modal'
import { toast } from '../components/ui/Toaster'
import type { Session } from '../lib/types'

export function Sessions() {
  const { data, loading, error, reload } = useResource(() => api.sessions(), [])
  const { telemetry } = useLive()
  if (loading && !data) return <Loading label="Loading sessions…" />
  if (error) return <ErrorNote message={error} onRetry={reload} />

  const live = (s: Session) => telemetry?.sessions[s.id]
  const disconnect = async (s: Session) => {
    const ok = await confirmModal({ title: 'Disconnect session?', message: `End ${s.userName}’s session from ${s.location}.`, confirmText: 'Disconnect', tone: 'danger' })
    if (ok) toast.success('Session disconnected')
  }

  const cols: Column<Session>[] = [
    { key: 'status', header: 'State', width: 112, render: (s) => <StatusBadge status={s.status} /> },
    { key: 'user', header: 'User', width: 210, render: (s) => (<div className="row gap-2"><span className="avatar avatar-sm">{s.userName.charAt(0)}</span><div><div className="cell-strong">{s.userName}</div><div className="cell-sub mono">{s.deviceName}</div></div></div>) },
    { key: 'location', header: 'Location', width: 150 },
    { key: 'clientIp', header: 'Client IP', width: 144, mono: true },
    { key: 'assignedIp', header: 'Corp IP', width: 144, mono: true },
    { key: 'dur', header: 'Duration', width: 110, mono: true, render: (s) => duration(s.startedAt) },
    { key: 'rate', header: 'Throughput', width: 128, align: 'right', render: (s) => { const l = live(s); return <span className="mono tnum">{fmtRate((l?.rxMbps ?? s.rxMbps) + (l?.txMbps ?? s.txMbps))}</span> } },
    { key: 'act', header: '', width: 132, align: 'right', render: (s) => (s.status === 'connected' ? <Button size="sm" variant="ghost" onClick={() => disconnect(s)}>Disconnect</Button> : null) },
  ]

  return (
    <>
      <PageHead title="Sessions" desc="Live remote-access connections into the corporate network." />
      <DataTable columns={cols} rows={data ?? []} empty="No active sessions." />
    </>
  )
}
