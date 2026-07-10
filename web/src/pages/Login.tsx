import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { PasswordInput } from '../components/ui/PasswordInput'
import { Button } from '../components/ui/primitives'
import { toast } from '../components/ui/Toaster'

export function Login() {
  const { login } = useAuth()
  const [pw, setPw] = useState('')
  const [code, setCode] = useState('')
  const [mfaStep, setMfaStep] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await login(pw, mfaStep ? code : undefined)
      toast.success('Control plane unlocked')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed'
      if (msg === 'mfa_required') {
        setMfaStep(true)
        toast.info('Enter your authenticator code')
      } else {
        toast.error(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login grid-bg">
      <div className="login-card">
        <div className="login-brand">
          <svg width="34" height="34" viewBox="0 0 26 26" fill="none" aria-hidden>
            <rect x="1" y="1" width="24" height="24" rx="7" fill="var(--primary-soft)" stroke="var(--primary)" strokeWidth="1.3" />
            <circle cx="8.5" cy="13" r="2.1" fill="var(--primary)" />
            <circle cx="17.5" cy="13" r="2.1" fill="var(--primary)" />
            <path d="M10.6 13h4.8" stroke="var(--primary)" strokeWidth="1.6" strokeDasharray="2 2" />
          </svg>
          <span className="login-word">Cipher<span className="sb-word-accent">lane</span></span>
        </div>

        <svg className="login-schema" viewBox="0 0 320 40" fill="none" aria-hidden>
          <circle cx="26" cy="20" r="6" stroke="var(--primary)" strokeWidth="1.6" />
          <circle cx="294" cy="20" r="6" stroke="var(--primary)" strokeWidth="1.6" />
          <path className="flow-path" d="M34 20 H286" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
          <text x="26" y="38" className="login-schema-lbl">HQ</text>
          <text x="294" y="38" className="login-schema-lbl" textAnchor="end">PEER</text>
        </svg>

        <h1 className="login-title">Control plane access</h1>
        <p className="login-sub">
          {mfaStep ? 'Enter the 6-digit code from your authenticator app.' : 'Enter the operator passcode to open the console.'}
        </p>

        <form onSubmit={submit} className="stack" style={{ gap: 'var(--sp-4)' }}>
          <label className="field">
            <span className="field-label mono upper">Operator passcode</span>
            <PasswordInput id="passcode" name="passcode" autoComplete="current-password"
              value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••••" autoFocus={!mfaStep} disabled={mfaStep} />
          </label>
          {mfaStep && (
            <label className="field">
              <span className="field-label mono upper">Authenticator code</span>
              <input className="input mono" value={code} inputMode="numeric" autoComplete="one-time-code" autoFocus
                placeholder="123456" maxLength={6} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </label>
          )}
          <Button variant="primary" type="submit" disabled={busy || !pw || (mfaStep && code.length < 6)}>
            {busy ? 'Verifying…' : mfaStep ? 'Verify code' : 'Sign in'}
          </Button>
        </form>

        <div className="login-foot mono">
          <span>AES-256 · IPsec · WireGuard</span>
          <span className="login-hint">default · cipherlane</span>
        </div>
      </div>
    </div>
  )
}
