import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { NAV } from '../shell/nav'
import { Icon, type IconName } from './Icon'

let openFn: (() => void) | null = null
export function openCommandPalette() { openFn?.() }

interface Item { label: string; sub?: string; icon: IconName; path: string }

export function CommandPalette() {
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const [entities, setEntities] = useState<Item[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    openFn = () => setOpen(true)
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o) }
      else if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => { openFn = null; document.removeEventListener('keydown', onKey) }
  }, [])

  useEffect(() => {
    if (!open) { setQ(''); setSel(0); return }
    inputRef.current?.focus()
    if (entities.length === 0) {
      Promise.all([api.sites().catch(() => []), api.tunnels().catch(() => []), api.users().catch(() => [])]).then(([sites, tunnels, users]) => {
        const items: Item[] = []
        sites.forEach((s) => items.push({ label: s.name, sub: `Site · ${s.subnetCidr}`, icon: 'sites', path: `/sites/${s.id}` }))
        tunnels.forEach((t) => items.push({ label: t.name, sub: `Tunnel · ${t.protocol}`, icon: 'tunnels', path: `/tunnels/${t.id}` }))
        users.forEach((u) => items.push({ label: u.name, sub: `User · @${u.username}`, icon: 'users', path: `/users/${u.id}` }))
        setEntities(items)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const navItems: Item[] = useMemo(() => NAV.flatMap((g) => g.items.map((it) => ({ label: it.label, sub: g.label, icon: it.icon, path: it.path }))), [])
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return navItems.slice(0, 8)
    return [...navItems, ...entities].filter((i) => i.label.toLowerCase().includes(s) || i.sub?.toLowerCase().includes(s)).slice(0, 12)
  }, [q, entities, navItems])

  useEffect(() => { setSel(0) }, [q])
  if (!open) return null

  const go = (i: Item) => { setOpen(false); nav(i.path) }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[sel]) go(results[sel]) }
  }

  return (
    <div className="cmdk-overlay" onMouseDown={() => setOpen(false)}>
      <div className="cmdk" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cmdk-input-row">
          <Icon name="search" size={16} className="u-subtle" />
          <input ref={inputRef} className="cmdk-input" placeholder="Search pages, sites, tunnels, users…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
          <kbd className="cmdk-kbd mono">ESC</kbd>
        </div>
        <div className="cmdk-list">
          {results.map((i, idx) => (
            <button key={i.path + idx} className={`cmdk-item ${idx === sel ? 'is-sel' : ''}`} onMouseEnter={() => setSel(idx)} onClick={() => go(i)}>
              <span className="cmdk-ic"><Icon name={i.icon} size={16} /></span>
              <span className="grow"><span className="cmdk-label">{i.label}</span>{i.sub && <span className="cmdk-sub mono"> · {i.sub}</span>}</span>
              <Icon name="chevronRight" size={14} className="u-subtle" />
            </button>
          ))}
          {!results.length && <div className="cmdk-empty u-muted">No matches.</div>}
        </div>
      </div>
    </div>
  )
}
