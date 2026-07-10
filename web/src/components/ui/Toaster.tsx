import { useEffect, useState } from 'react'
import { Icon, type IconName } from './Icon'

type Kind = 'success' | 'error' | 'info' | 'warn'
interface Toast { id: number; kind: Kind; message: string }
type Listener = (t: Toast) => void

let listeners: Listener[] = []
let seq = 0
function emit(kind: Kind, message: string) {
  seq += 1
  const t = { id: seq, kind, message }
  listeners.forEach((l) => l(t))
}

// Tiny pubsub toast API — no global store needed.
export const toast = {
  success: (m: string) => emit('success', m),
  error: (m: string) => emit('error', m),
  info: (m: string) => emit('info', m),
  warn: (m: string) => emit('warn', m),
}

const ICONS: Record<Kind, IconName> = { success: 'check', error: 'close', info: 'dot', warn: 'alert' }

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([])
  useEffect(() => {
    const l: Listener = (t) => {
      setItems((cur) => [...cur, t])
      window.setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), 4200)
    }
    listeners.push(l)
    return () => { listeners = listeners.filter((x) => x !== l) }
  }, [])
  return (
    <div className="toaster" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} role="status">
          <span className="toast-ic"><Icon name={ICONS[t.kind]} size={15} /></span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
