import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { useLive } from '../lib/live'
import { usePageHeader } from '../components/shell/AppShell'
import { Loading, ErrorNote } from '../components/ui/Page'
import { Card, Button, Badge, StatusBadge, KeyVal, statusTone } from '../components/ui/primitives'
import { Icon } from '../components/ui/Icon'
import { platformIcon } from '../lib/kinds'
import { fmtRate, duration, timeAgo } from '../lib/format'
import { promptModal, confirmModal } from '../components/ui/Modal'
import { toast } from '../components/ui/Toaster'
import type { Device, Session } from '../lib/types'

export function UserDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { data, loading, error, reload } = useResource(() => api.user(id!), [id])
  const { telemetry } = useLive()
  usePageHeader('REMOTE ACCESS', data?.name, data ? `@${data.username}` : undefined)

  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorNote message={error ?? 'User not found'} onRetry={reload} />

  const enroll = async () => {
    const name = await promptModal({ title: 'Enroll a device', label: 'Device name', placeholder: 'e.g. laptop-01', confirmText: 'Generate profile' })
    if (name) toast.success(`Enrollment QR generated for “${name}”`)
  }
  const disconnect = async (s: Session) => {
    const ok = await confirmModal({ title: 'Disconnect session?', message: `End ${data.name}’s session from ${s.location}.`, confirmText: 'Disconnect', tone: 'danger' })
    if (ok) toast.success('Session disconnected')
  }

  return (
    <>
      <button className="back-link" onClick={() => nav('/users')}>
        <Icon name="chevronRight" size={14} style={{ transform: 'rotate(180deg)' }} /> Users
      </button>

      <Card className="profile-head card-pad">
        <span className="avatar avatar-lg">{data.name.charAt(0)}</span>
        <div className="grow">
          <div className="row gap-2">
            <h2 className="profile-name">{data.name}</h2>
            <StatusBadge status={data.status} />
          </div>
          <div className="profile-meta mono">@{data.username} · {data.email}</div>
          <div className="row gap-2" style={{ marginTop: 'var(--sp-2)' }}>
            <Badge>{data.role}</Badge><Badge>{data.group}</Badge>
            <Badge tone={data.mfaEnabled ? 'up' : 'warn'}>MFA {data.mfaEnabled ? 'on' : 'off'}</Badge>
          </div>
        </div>
        <Button variant="primary" icon="qr" onClick={enroll}>Enroll device</Button>
      </Card>

      <div className="ov-grid ov-grid-a" style={{ marginTop: 'var(--sp-5)' }}>
        <Card className="ov-panel">
          <div className="card-head"><div className="card-title">Access</div></div>
          <dl className="kv-list">
            <KeyVal k="Tunnel mode" v={<span style={{ textTransform: 'capitalize' }}>{data.tunnelMode} tunnel</span>} />
            <KeyVal k="Corporate IP" v={data.corporateIp} mono />
            <KeyVal k="MFA" v={data.mfaEnabled ? 'Enabled (TOTP)' : 'Not enrolled'} />
            <KeyVal k="Role" v={data.role} />
            <KeyVal k="Group" v={data.group} />
          </dl>
          <div className="section-label mono upper" style={{ margin: 'var(--sp-5) 0 var(--sp-2)' }}>Devices</div>
          {(data.devices ?? []).map((d) => <DeviceRow key={d.id} d={d} />)}
          {!data.devices?.length && <div className="u-muted mono" style={{ fontSize: 'var(--fs-xs)' }}>No devices enrolled.</div>}
        </Card>

        <Card className="ov-panel">
          <div className="card-head"><div className="card-title">Sessions</div></div>
          {(data.sessions ?? []).map((s) => {
            const live = telemetry?.sessions[s.id]
            const total = (live?.rxMbps ?? s.rxMbps) + (live?.txMbps ?? s.txMbps)
            return (
              <div key={s.id} className="feed-row">
                <span className={`dot dot-${statusTone(s.status)}`} />
                <div className="grow">
                  <div className="feed-title">{s.location} · <span className="mono u-muted">{s.clientIp}</span></div>
                  <div className="feed-sub mono">{duration(s.startedAt)} · {fmtRate(total)}</div>
                </div>
                {s.status === 'connected' && <Button size="sm" variant="ghost" onClick={() => disconnect(s)}>Disconnect</Button>}
              </div>
            )
          })}
          {!data.sessions?.length && <div className="u-muted mono" style={{ fontSize: 'var(--fs-xs)' }}>No sessions on record.</div>}
        </Card>
      </div>
    </>
  )
}

function DeviceRow({ d }: { d: Device }) {
  return (
    <div className="feed-row">
      <span className="res-ic"><Icon name={platformIcon(d.platform)} size={15} /></span>
      <div className="grow"><div className="feed-title">{d.name}</div><div className="feed-sub mono">{d.platform} · handshake {timeAgo(d.lastHandshake)}</div></div>
      <Badge tone={statusTone(d.status)}>{d.status}</Badge>
    </div>
  )
}
