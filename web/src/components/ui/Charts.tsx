import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SeriesPoint } from '../../lib/types'
import { fmtRate } from '../../lib/format'

interface TTProps { active?: boolean; payload?: Array<{ value: number; payload: { rx: number; tx: number } }> }

function ThroughputTip({ active, payload }: TTProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="chart-tt mono">
      <div className="chart-tt-total">{fmtRate(payload[0].value)}</div>
      <div className="chart-tt-split">↓ {fmtRate(p.rx)} · ↑ {fmtRate(p.tx)}</div>
    </div>
  )
}

export function ThroughputArea({ data, height = 220 }: { data: SeriesPoint[]; height?: number }) {
  const rows = data.map((p, i) => ({ i, total: Math.round((p.rx + p.tx) * 10) / 10, rx: p.rx, tx: p.tx }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={rows} margin={{ top: 8, right: 6, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="clArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.30} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="i" hide />
        <YAxis hide domain={[0, (max: number) => Math.ceil((max + 40) / 50) * 50]} />
        <Tooltip content={<ThroughputTip />} cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '3 3' }} />
        <Area type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2}
          fill="url(#clArea)" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
