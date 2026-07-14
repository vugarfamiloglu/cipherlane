import { useState } from 'react'
import { Modal } from './Modal'
import { Button } from './primitives'
import { PasswordInput } from './PasswordInput'
import { toast } from './Toaster'

export interface Field {
  name: string
  label: string
  type?: 'text' | 'select' | 'password'
  options?: { value: string; label: string }[]
  placeholder?: string
  required?: boolean
  default?: string
}

// A small generic create-form rendered in a modal, used by the tunnel / site /
// policy wizards. Handles local state, validation, and submit lifecycle.
export function FormModal({
  title, fields, submitLabel = 'Create', onClose, onSubmit,
}: {
  title: string
  fields: Field[]
  submitLabel?: string
  onClose: () => void
  onSubmit: (values: Record<string, string>) => Promise<void>
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, f.default ?? (f.type === 'select' ? f.options?.[0]?.value ?? '' : '')])),
  )
  const [busy, setBusy] = useState(false)
  const set = (n: string, v: string) => setValues((c) => ({ ...c, [n]: v }))
  const valid = fields.every((f) => !f.required || (values[f.name] ?? '').trim() !== '')

  const submit = async () => {
    if (!valid || busy) return
    setBusy(true)
    try {
      await onSubmit(values)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="stack" style={{ gap: 'var(--sp-4)' }}>
        {fields.map((f) => (
          <label key={f.name} className="field">
            <span className="field-label mono upper">{f.label}</span>
            {f.type === 'select' ? (
              <select className="input select" value={values[f.name]} onChange={(e) => set(f.name, e.target.value)}>
                {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : f.type === 'password' ? (
              <PasswordInput value={values[f.name]} placeholder={f.placeholder}
                onChange={(e) => set(f.name, e.target.value)} />
            ) : (
              <input className="input" value={values[f.name]} placeholder={f.placeholder}
                onChange={(e) => set(f.name, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
            )}
          </label>
        ))}
      </div>
      <div className="modal-actions">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!valid || busy} onClick={submit}>{busy ? 'Saving…' : submitLabel}</Button>
      </div>
    </Modal>
  )
}
