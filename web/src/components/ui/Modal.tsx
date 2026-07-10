import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from './primitives'
import { PasswordInput } from './PasswordInput'

// ---- Imperative confirm / prompt (never window.confirm / window.prompt) ------

interface ConfirmOpts { title: string; message?: ReactNode; confirmText?: string; cancelText?: string; tone?: 'default' | 'danger' }
interface PromptOpts { title: string; message?: ReactNode; label?: string; placeholder?: string; defaultValue?: string; confirmText?: string; secret?: boolean }

type Req =
  | { kind: 'confirm'; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: 'prompt'; opts: PromptOpts; resolve: (v: string | null) => void }

let pushReq: ((r: Req) => void) | null = null

export function confirmModal(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => pushReq?.({ kind: 'confirm', opts, resolve }))
}
export function promptModal(opts: PromptOpts): Promise<string | null> {
  return new Promise((resolve) => pushReq?.({ kind: 'prompt', opts, resolve }))
}

export function ModalHost() {
  const [req, setReq] = useState<Req | null>(null)
  const [value, setValue] = useState('')

  useEffect(() => {
    pushReq = (r) => {
      setValue(r.kind === 'prompt' ? (r.opts.defaultValue ?? '') : '')
      setReq(r)
    }
    return () => { pushReq = null }
  }, [])

  const finish = (result: boolean | string | null) => {
    if (!req) return
    if (req.kind === 'confirm') req.resolve(result as boolean)
    else req.resolve(result as string | null)
    setReq(null)
  }
  const cancel = () => finish(req?.kind === 'confirm' ? false : null)

  return (
    <AnimatePresence>
      {req && (
        <Modal title={req.opts.title} onClose={cancel}>
          {req.opts.message && <p className="modal-msg">{req.opts.message}</p>}
          {req.kind === 'prompt' && (
            <label className="field">
              {req.opts.label && <span className="field-label mono upper">{req.opts.label}</span>}
              {req.opts.secret ? (
                <PasswordInput value={value} onChange={(e) => setValue(e.target.value)} placeholder={req.opts.placeholder} autoFocus />
              ) : (
                <input className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder={req.opts.placeholder} autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') finish(value) }} />
              )}
            </label>
          )}
          <div className="modal-actions">
            <Button variant="ghost" onClick={cancel}>
              {(req.kind === 'confirm' && req.opts.cancelText) || 'Cancel'}
            </Button>
            <Button
              variant={req.kind === 'confirm' && req.opts.tone === 'danger' ? 'danger' : 'primary'}
              onClick={() => finish(req.kind === 'confirm' ? true : value)}
            >
              {req.kind === 'confirm' ? (req.opts.confirmText ?? 'Confirm') : (req.opts.confirmText ?? 'Save')}
            </Button>
          </div>
        </Modal>
      )}
    </AnimatePresence>
  )
}

export function Modal({ title, children, onClose, wide }: { title?: ReactNode; children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
      <motion.div
        className={`modal ${wide ? 'modal-wide' : ''}`}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title && <div className="modal-head">{title}</div>}
        <div className="modal-body">{children}</div>
      </motion.div>
    </motion.div>
  )
}
