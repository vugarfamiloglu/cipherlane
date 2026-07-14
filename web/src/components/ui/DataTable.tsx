import { useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

export interface Column<T> {
  key: string
  header: string
  width?: number
  align?: 'left' | 'right' | 'center'
  mono?: boolean
  render?: (row: T) => ReactNode
}

// A dense table with drag-to-resize columns and a sticky header. Column widths
// live in local state so the layout survives re-renders while data streams in.
// Pass `search` (a row → haystack string) to get a live filter toolbar.
export function DataTable<T extends { id: string }>({
  columns, rows, onRowClick, empty, search, searchPlaceholder, toolbar,
}: {
  columns: Column<T>[]
  rows: T[]
  onRowClick?: (row: T) => void
  empty?: ReactNode
  search?: (row: T) => string
  searchPlaceholder?: string
  toolbar?: ReactNode
}) {
  const [widths, setWidths] = useState<Record<string, number>>(
    () => Object.fromEntries(columns.map((c) => [c.key, c.width ?? 160])),
  )
  const [q, setQ] = useState('')
  const drag = useRef<{ key: string; startX: number; startW: number } | null>(null)

  const query = q.trim().toLowerCase()
  const filtered = search && query ? rows.filter((r) => search(r).toLowerCase().includes(query)) : rows

  const onDown = (e: React.MouseEvent, key: string) => {
    e.preventDefault()
    e.stopPropagation()
    drag.current = { key, startX: e.clientX, startW: widths[key] ?? 160 }
    const move = (ev: MouseEvent) => {
      if (!drag.current) return
      const w = Math.max(72, drag.current.startW + (ev.clientX - drag.current.startX))
      setWidths((cur) => ({ ...cur, [drag.current!.key]: w }))
    }
    const up = () => {
      drag.current = null
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      document.body.classList.remove('col-resizing')
    }
    document.body.classList.add('col-resizing')
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const total = columns.reduce((s, c) => s + (widths[c.key] ?? 160), 0)

  return (
    <div className="dt-outer">
      {(search || toolbar) && (
        <div className="dt-toolbar">
          {search && (
            <div className="dt-search">
              <Icon name="search" size={15} className="u-subtle" />
              <input className="dt-search-input" placeholder={searchPlaceholder ?? 'Search…'} value={q} onChange={(e) => setQ(e.target.value)} />
              {q && <button className="dt-search-clear" onClick={() => setQ('')} aria-label="Clear search"><Icon name="close" size={14} /></button>}
            </div>
          )}
          {toolbar}
          <span className="dt-count mono">{filtered.length}{filtered.length !== rows.length ? ` / ${rows.length}` : ''}</span>
        </div>
      )}
      <div className="dt-wrap">
        <table className="dt" style={{ minWidth: total }}>
          <colgroup>
            {columns.map((c) => <col key={c.key} style={{ width: widths[c.key] }} />)}
          </colgroup>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`dt-th align-${c.align ?? 'left'}`}>
                  <span className="dt-th-label mono upper">{c.header}</span>
                  <span className="dt-resize" onMouseDown={(e) => onDown(e, c.key)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className={onRowClick ? 'dt-row dt-clickable' : 'dt-row'} onClick={() => onRowClick?.(row)}>
                {columns.map((c) => (
                  <td key={c.key} className={`align-${c.align ?? 'left'} ${c.mono ? 'mono' : ''}`}>
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div className="dt-empty">{rows.length === 0 ? (empty ?? 'No records.') : `No matches for “${q.trim()}”.`}</div>
      )}
    </div>
  )
}
