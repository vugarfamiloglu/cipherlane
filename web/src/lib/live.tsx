import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Telemetry } from './types'

interface LiveState {
  telemetry: Telemetry | null
  connected: boolean
}

const LiveCtx = createContext<LiveState>({ telemetry: null, connected: false })

/**
 * LiveProvider keeps a single WebSocket to /ws and shares the latest telemetry
 * snapshot with the whole app, reconnecting automatically if it drops.
 */
export function LiveProvider({ children }: { children: ReactNode }) {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let ws: WebSocket | null = null
    let retry: number | undefined
    let closed = false

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${location.host}/ws`)
      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false)
        if (!closed) retry = window.setTimeout(connect, 1500)
      }
      ws.onerror = () => ws?.close()
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          if (msg?.type === 'telemetry' && msg.data) setTelemetry(msg.data as Telemetry)
        } catch {
          /* ignore malformed frame */
        }
      }
    }

    connect()
    return () => {
      closed = true
      if (retry) clearTimeout(retry)
      ws?.close()
    }
  }, [])

  return <LiveCtx.Provider value={{ telemetry, connected }}>{children}</LiveCtx.Provider>
}

export const useLive = () => useContext(LiveCtx)
