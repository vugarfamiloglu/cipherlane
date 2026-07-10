import { useState } from 'react'
import QRCode from 'qrcode'
import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { useTheme } from '../hooks/useTheme'
import { PageHead } from '../components/ui/Page'
import { Card, Button, Badge, KeyVal } from '../components/ui/primitives'
import { promptModal, confirmModal } from '../components/ui/Modal'
import { toast } from '../components/ui/Toaster'

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

export function Settings() {
  const { theme, set } = useTheme()

  const changePass = async () => {
    const p = await promptModal({ title: 'Change operator passcode', label: 'New passcode', secret: true, placeholder: '••••••••••', confirmText: 'Update' })
    if (p) toast.success('Passcode updated (demo)')
  }
  const backup = () => toast.success('Encrypted backup archive generated')
  const reset = async () => {
    const ok = await confirmModal({ title: 'Reset demo estate?', message: 'In a live deployment this reseeds the database. Disabled here.', confirmText: 'Reset', tone: 'danger' })
    if (ok) toast.info('Reset is disabled in this demo')
  }

  return (
    <>
      <PageHead title="Settings" desc="Console appearance, security, MFA, and gateway enrolment." />

      <div className="ov-grid ov-grid-a">
        <Card className="ov-panel">
          <div className="card-head"><div className="card-title">Appearance</div></div>
          <div className="setting-row">
            <div><div className="feed-title">Theme</div><div className="feed-sub">Engineering paper (light) or night drafting table (dark).</div></div>
            <div className="row gap-2">
              <Button variant={theme === 'light' ? 'primary' : 'default'} size="sm" icon="sun" onClick={() => set('light')}>Light</Button>
              <Button variant={theme === 'dark' ? 'primary' : 'default'} size="sm" icon="moon" onClick={() => set('dark')}>Dark</Button>
            </div>
          </div>
          <div className="setting-row"><div><div className="feed-title">Operator passcode</div><div className="feed-sub">Rotate the console sign-in passcode.</div></div><Button variant="default" size="sm" onClick={changePass}>Change</Button></div>
          <div className="setting-row"><div><div className="feed-title">Secret vault</div><div className="feed-sub">Keys sealed with AES-256-GCM.</div></div><Badge tone="up">sealed</Badge></div>
        </Card>

        <MfaCard />
      </div>

      <div className="ov-grid ov-grid-a">
        <AgentCard />
        <Card className="ov-panel">
          <div className="card-head"><div className="card-title">Console &amp; data</div></div>
          <dl className="kv-list">
            <KeyVal k="Control plane" v="Go · chi · SQLite (WAL)" />
            <KeyVal k="Listen port" v="7820" mono />
            <KeyVal k="Telemetry" v="WebSocket · 2s tick" />
            <KeyVal k="Version" v="0.2.0" mono />
          </dl>
          <div className="setting-row"><div><div className="feed-title">Backup</div><div className="feed-sub">Download an encrypted snapshot.</div></div><Button variant="default" size="sm" icon="download" onClick={backup}>Backup</Button></div>
          <div className="setting-row"><div><div className="feed-title">Reset estate</div><div className="feed-sub">Reseed the demo dataset.</div></div><Button variant="danger" size="sm" onClick={reset}>Reset</Button></div>
        </Card>
      </div>
    </>
  )
}

function MfaCard() {
  const status = useResource(() => api.mfaStatus(), [])
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null)
  const [qr, setQr] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const begin = async () => {
    setBusy(true)
    try {
      const s = await api.mfaSetup()
      setSetup(s)
      setQr(await QRCode.toDataURL(s.otpauthUri, { margin: 1, width: 180, color: { dark: '#0b1117', light: '#ffffff' } }))
    } catch (e) { toast.error(errMsg(e)) } finally { setBusy(false) }
  }
  const activate = async () => {
    setBusy(true)
    try { await api.mfaActivate(code); toast.success('MFA enabled'); setSetup(null); setCode(''); status.reload() }
    catch (e) { toast.error(errMsg(e)) } finally { setBusy(false) }
  }
  const disable = async () => {
    const c = await promptModal({ title: 'Disable MFA', label: 'Authenticator code', placeholder: '123456', confirmText: 'Disable' })
    if (c == null) return
    try { await api.mfaDisable(c); toast.success('MFA disabled'); status.reload() } catch (e) { toast.error(errMsg(e)) }
  }

  const enabled = status.data?.enabled
  return (
    <Card className="ov-panel">
      <div className="card-head"><div className="card-title">Multi-factor auth (TOTP)</div>{enabled !== undefined && <Badge tone={enabled ? 'up' : 'idle'}>{enabled ? 'enabled' : 'off'}</Badge>}</div>
      {enabled ? (
        <>
          <p className="u-muted" style={{ fontSize: 'var(--fs-sm)' }}>A 6-digit authenticator code is required at every sign-in.</p>
          <Button variant="default" size="sm" onClick={disable} style={{ marginTop: 'var(--sp-3)' }}>Disable MFA</Button>
        </>
      ) : setup ? (
        <div className="mfa-setup">
          <p className="u-muted" style={{ fontSize: 'var(--fs-sm)' }}>Scan with Google Authenticator or Authy, then enter the code.</p>
          {qr && <img className="mfa-qr" src={qr} alt="MFA enrolment QR code" width={160} height={160} />}
          <div className="mfa-secret mono">{setup.secret}</div>
          <label className="field">
            <span className="field-label mono upper">Authenticator code</span>
            <input className="input mono" value={code} maxLength={6} placeholder="123456"
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          </label>
          <div className="row gap-2">
            <Button variant="primary" size="sm" disabled={code.length < 6 || busy} onClick={activate}>Activate</Button>
            <Button variant="ghost" size="sm" onClick={() => setSetup(null)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          <p className="u-muted" style={{ fontSize: 'var(--fs-sm)' }}>Protect the console sign-in with a time-based one-time password.</p>
          <Button variant="primary" size="sm" disabled={busy} onClick={begin} style={{ marginTop: 'var(--sp-3)' }}>{busy ? 'Preparing…' : 'Enable MFA'}</Button>
        </>
      )}
    </Card>
  )
}

function AgentCard() {
  const tok = useResource(() => api.agentToken(), [])
  const [shown, setShown] = useState(false)
  const t = tok.data?.token ?? ''
  const masked = t ? '•'.repeat(Math.min(28, t.length)) : '…'
  const cmd = `./cipherlane-agent \\
  -server ${location.origin} \\
  -token ${shown && t ? t : '<token>'} \\
  -gateway gw_hq -iface wg0`

  return (
    <Card className="ov-panel">
      <div className="card-head"><div className="card-title">Gateway agent</div></div>
      <p className="u-muted" style={{ fontSize: 'var(--fs-sm)' }}>Run the agent on a Linux gateway to apply WireGuard configs and stream real interface counters.</p>
      <div className="setting-row">
        <div><div className="feed-title">Enrolment token</div><div className="feed-sub mono">{shown ? t : masked}</div></div>
        <div className="row gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShown((s) => !s)}>{shown ? 'Hide' : 'Reveal'}</Button>
          <Button size="sm" variant="default" icon="copy" onClick={() => { navigator.clipboard?.writeText(t); toast.success('Agent token copied') }}>Copy</Button>
        </div>
      </div>
      <pre className="codeblock mono">{cmd}</pre>
    </Card>
  )
}
