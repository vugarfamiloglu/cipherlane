import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

interface Override { crumb: string; title: string; subtitle?: string }
const HeaderCtx = createContext<{ setOverride: (o: Override | null) => void }>({ setOverride: () => {} })

/** Pages call this to give the top bar a specific crumb/title (e.g. detail views). */
export function usePageHeader(crumb: string | undefined, title: string | undefined, subtitle?: string) {
  const { setOverride } = useContext(HeaderCtx)
  useEffect(() => {
    if (title) setOverride({ crumb: crumb ?? '', title, subtitle })
    return () => setOverride(null)
  }, [crumb, title, subtitle, setOverride])
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('cl-sb') === '1')
  const [override, setOverride] = useState<Override | null>(null)

  const toggle = () =>
    setCollapsed((c) => {
      localStorage.setItem('cl-sb', c ? '0' : '1')
      return !c
    })

  return (
    <HeaderCtx.Provider value={{ setOverride }}>
      <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
        <Sidebar collapsed={collapsed} onToggle={toggle} />
        <TopBar override={override} />
        <main className="workbench grid-bg">
          <div className="workbench-inner">
            <Outlet />
          </div>
        </main>
      </div>
    </HeaderCtx.Provider>
  )
}
