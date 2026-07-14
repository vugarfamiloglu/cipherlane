import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { LiveProvider } from './lib/live'
import { AppShell } from './components/shell/AppShell'
import { Spinner } from './components/ui/primitives'
import { Login } from './pages/Login'
import { Overview } from './pages/Overview'
import { Topology } from './pages/Topology'
import { Sites } from './pages/Sites'
import { SiteDetail } from './pages/SiteDetail'
import { Tunnels } from './pages/Tunnels'
import { TunnelDetail } from './pages/TunnelDetail'
import { Gateways } from './pages/Gateways'
import { CloudConnectors } from './pages/CloudConnectors'
import { Users } from './pages/Users'
import { UserDetail } from './pages/UserDetail'
import { Sessions } from './pages/Sessions'
import { Resources } from './pages/Resources'
import { Vault } from './pages/Vault'
import { Monitoring } from './pages/Monitoring'
import { Team } from './pages/Team'
import { Analytics } from './pages/Analytics'
import { Settings } from './pages/Settings'

export function App() {
  const { authed, ready } = useAuth()
  if (!ready) return <div className="boot"><Spinner size={26} /></div>
  if (!authed) return <Login />

  return (
    <LiveProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Overview />} />
          <Route path="/topology" element={<Topology />} />
          <Route path="/sites" element={<Sites />} />
          <Route path="/sites/:id" element={<SiteDetail />} />
          <Route path="/tunnels" element={<Tunnels />} />
          <Route path="/tunnels/:id" element={<TunnelDetail />} />
          <Route path="/gateways" element={<Gateways />} />
          <Route path="/cloud" element={<CloudConnectors />} />
          <Route path="/users" element={<Users />} />
          <Route path="/users/:id" element={<UserDetail />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/vault" element={<Vault />} />
          <Route path="/monitoring" element={<Monitoring />} />
          <Route path="/team" element={<Team />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </LiveProvider>
  )
}
