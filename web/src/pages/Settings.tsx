import { useTheme } from '../hooks/useTheme'
import { PageHead } from '../components/ui/Page'
import { Card, Button, Badge, KeyVal } from '../components/ui/primitives'
import { promptModal, confirmModal } from '../components/ui/Modal'
import { toast } from '../components/ui/Toaster'

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
      <PageHead title="Settings" desc="Console appearance, security, and data controls." />

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
        </Card>

        <Card className="ov-panel">
          <div className="card-head"><div className="card-title">Security</div></div>
          <div className="setting-row"><div><div className="feed-title">Operator passcode</div><div className="feed-sub">Rotate the console sign-in passcode.</div></div><Button variant="default" size="sm" onClick={changePass}>Change</Button></div>
          <div className="setting-row"><div><div className="feed-title">Multi-factor auth</div><div className="feed-sub">TOTP enforced for admin roles.</div></div><Badge tone="up">enabled</Badge></div>
          <div className="setting-row"><div><div className="feed-title">Secret vault</div><div className="feed-sub">Keys sealed with AES-256-GCM.</div></div><Badge tone="up">sealed</Badge></div>
        </Card>
      </div>

      <div className="ov-grid ov-grid-a">
        <Card className="ov-panel">
          <div className="card-head"><div className="card-title">Console</div></div>
          <dl className="kv-list">
            <KeyVal k="Control plane" v="Go · chi · SQLite (WAL)" />
            <KeyVal k="Listen port" v="7820" mono />
            <KeyVal k="Telemetry" v="WebSocket · 2s tick" />
            <KeyVal k="Version" v="0.1.0" mono />
          </dl>
        </Card>

        <Card className="ov-panel">
          <div className="card-head"><div className="card-title">Data</div></div>
          <div className="setting-row"><div><div className="feed-title">Backup</div><div className="feed-sub">Download an encrypted snapshot.</div></div><Button variant="default" size="sm" icon="download" onClick={backup}>Backup</Button></div>
          <div className="setting-row"><div><div className="feed-title">Reset estate</div><div className="feed-sub">Reseed the demo dataset.</div></div><Button variant="danger" size="sm" onClick={reset}>Reset</Button></div>
        </Card>
      </div>
    </>
  )
}
