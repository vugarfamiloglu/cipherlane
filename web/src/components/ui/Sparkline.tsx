// A tiny inline sparkline for tables and cards. Pure SVG, no dependencies.
export function Sparkline({
  data, width = 96, height = 26, stroke = 'var(--primary)', fill = true,
}: { data: number[]; width?: number; height?: number; stroke?: string; fill?: boolean }) {
  if (!data || data.length < 2) return <svg width={width} height={height} aria-hidden />
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const pad = 2
  const stepX = (width - pad * 2) / (data.length - 1)
  const pts = data.map((v, i) => {
    const x = pad + i * stepX
    const y = height - pad - ((v - min) / span) * (height - pad * 2)
    return [x, y] as const
  })
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${height} L${pts[0][0].toFixed(1)} ${height} Z`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="sparkline">
      {fill && <path d={area} fill={stroke} opacity={0.1} />}
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
