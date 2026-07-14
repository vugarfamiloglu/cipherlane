import { useState } from 'react'
import QRCode from 'qrcode'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { useLive } from '../lib/live'
import { usePageHeader } from '../components/shell/AppShell'
import { Loading, ErrorNote } from '../components/ui/Page'
import { Card, Button, Badge, StatusBadge, KeyVal, statusTone } from '../components/ui/primitives'
import { Icon } from '../components/ui/Icon'
import { Modal, confirmModal } from '../components/ui/Modal'
import { FormModal } from '../components/ui/FormModal'
import { platformIcon } from '../lib/kinds'
import { fmtRate, duration, timeAgo } from '../lib/format'
import { toast } from '../components/ui/Toaster'
import { confirmDelete, errMsg, downloadText } from '../lib/ui'
import { userFields, userPayload } from './Users'
import type { Device, Session } from '../lib/types'

export function UserDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { data, loading, error, reload } = useResource(() => api.user(id!), [id])
  const { telemetry } = useLive()
  usePageHeader('REMOTE ACCESS', data?.name, data ? `@${data.username}` : undefined)

  const [enrollForm, setEnrollForm] = useState(false)
  const [editForm, setEditForm] = useState(false)
  const [enrolled, setEnrolled] = useState<{ name: string; config: string; qr: string } | null>(null)

  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorNote message={error ?? 'User not found'} onRetry={reload} />

  const enroll = async (v: Record<string, string>) => {
    const r = await api.enrollDevice(data.id, { name: v.name, platform: v.platform })
    const qr = await QRCode.toDataURL(r.config, { margin: 1, width: 190, errorCorrectionLevel: 'L', color: { dark: '#0b1117', light: '#ffffff' } })
    setEnrolled({ name: v.name, config: r.config, qr })
    reload()
  }
  const disconnect = async (s: Session) => {
    const ok = await confirmModal({ title: 'Disconnect session?', message: `End the session from ${s.location}.`, confirmText: 'Disconnect', tone: 'danger' })
    if (!ok) return
    try { await api.disconnectSession(s.id); toast.success('Session disconnected'); reload() } catch (e) { toast.error(errMsg(e)) }
  }

  return (
    <>
      <button className="back-link" onClick={() => nav('/users')}>
        <Icon name="chevronRight" size={14} style={{ transform: 'rotate(180deg)' }} /> Users
      </button>

      <Card className="profile-head card-pad">
        <span className="avatar avatar-lg">{data.name.charAt(0)}</span>
        <div className="grow">
          <div className="row gap-2"><h2 className="profile-name">{data.name}</h2><StatusBadge status={data.status} /></div>
          <div className="profile-meta mono">@{data.username} · {data.email}</div>
          <div className="row gap-2" style={{ marginTop: 'var(--sp-2)' }}>
            <Badge>{data.role}</Badge><Badge>{data.group}</Badge><Badge tone={data.mfaEnabled ? 'up' : 'warn'}>MFA {data.mfaEnabled ? 'on' : 'off'}</Badge>
          </div>
        </div>
        <div className="detail-actions">
          <Button variant="default" icon="edit" onClick={() => setEditForm(true)}>Edit</Button>
          <Button variant="primary" icon="qr" onClick={() => setEnrollForm(true)}>Enroll device</Button>
        </div>
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
          {(data.devices ?? []).map((d) => <DeviceRow key={d.id} d={d} onDelete={() => confirmDelete(d.name, () => api.deleteDevice(d.id), reload)} />)}
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

      <Card className="card-pad section-block">
        <div className="card-head"><div className="card-title">Danger zone</div></div>
        <div className="setting-row">
          <div><div className="feed-title">Delete user</div><div className="feed-sub">Removes {data.name}, their devices, and sessions.</div></div>
          <Button variant="danger" size="sm" onClick={() => confirmDelete(data.name, () => api.deleteUser(data.id), () => nav('/users'))}>Delete</Button>
        </div>
      </Card>

      {enrollForm && (
        <FormModal title="Enroll a device" submitLabel="Generate config" onClose={() => setEnrollForm(false)} onSubmit={enroll}
          fields={[
            { name: 'name', label: 'Device name', required: true, placeholder: 'e.g. laptop-01' },
            { name: 'platform', label: 'Platform', type: 'select', options: ['windows', 'macos', 'linux', 'android', 'ios'].map((v) => ({ value: v, label: v })) },
          ]} />
      )}
      {editForm && (
        <FormModal title={`Edit ${data.name}`} submitLabel="Save changes" onClose={() => setEditForm(false)}
          onSubmit={async (v) => { await api.updateUser(data.id, userPayload(v)); toast.success('User updated'); reload() }}
          fields={userFields(data)} />
      )}
      {enrolled && (
        <Modal title={`${enrolled.name} — WireGuard profile`} onClose={() => setEnrolled(null)} wide>
          <div className="enroll-grid">
            <img className="mfa-qr" src={enrolled.qr} alt="Device configuration QR code" width={190} height={190} />
            <div className="grow">
              <p className="u-muted" style={{ fontSize: 'var(--fs-sm)' }}>Scan with the WireGuard app, or copy / download the config.</p>
              <pre className="codeblock mono" style={{ maxHeight: 200 }}>{enrolled.config}</pre>
              <div className="row gap-2" style={{ marginTop: 'var(--sp-3)' }}>
                <Button size="sm" icon="copy" onClick={() => { navigator.clipboard?.writeText(enrolled.config); toast.success('Config copied') }}>Copy</Button>
                <Button size="sm" variant="default" icon="download" onClick={() => downloadText(enrolled.config, `${enrolled.name}.conf`)}>Download</Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

function DeviceRow({ d, onDelete }: { d: Device; onDelete: () => void }) {
  return (
    <div className="feed-row">
      <span className="res-ic"><Icon name={platformIcon(d.platform)} size={15} /></span>
      <div className="grow"><div className="feed-title">{d.name}</div><div className="feed-sub mono">{d.platform} · handshake {timeAgo(d.lastHandshake)}</div></div>
      <button className="row-act danger" title="Remove device" onClick={onDelete}><Icon name="trash" size={15} /></button>
    </div>
  )
}
