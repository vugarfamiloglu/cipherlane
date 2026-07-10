import { useRef, useState, type ReactNode } from 'react'

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
export function DataTable<T extends { id: string }>({
  columns, rows, onRowClick, empty,
}: {
  columns: Column<T>[]
  rows: T[]
  onRowClick?: (row: T) => void
  empty?: ReactNode
}) {
  const [widths, setWidths] = useState<Record<string, number>>(
    () => Object.fromEntries(columns.map((c) => [c.key, c.width ?? 160])),
  )
  const drag = useRef<{ key: string; startX: number; startW: number } | null>(null)

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
          {rows.map((row) => (
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
      {rows.length === 0 && <div className="dt-empty">{empty ?? 'No records.'}</div>}
    </div>
  )
}
