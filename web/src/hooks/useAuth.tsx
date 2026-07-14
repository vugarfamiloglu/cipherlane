import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api'

interface AuthState {
  authed: boolean
  ready: boolean
  role: string
  name: string
  canWrite: boolean
  login: (creds: Record<string, string>) => Promise<void>
  logout: () => Promise<void>
}

const AuthCtx = createContext<AuthState>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false)
  const [ready, setReady] = useState(false)
  const [role, setRole] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    api.me()
      .then((r) => { setAuthed(r.authenticated); setRole(r.role ?? ''); setName(r.name ?? '') })
      .catch(() => setAuthed(false))
      .finally(() => setReady(true))
  }, [])

  const login = useCallback(async (creds: Record<string, string>) => {
    const r = await api.login(creds)
    setAuthed(r.authenticated)
    setRole(r.role ?? '')
    setName(r.name ?? '')
  }, [])

  const logout = useCallback(async () => {
    try { await api.logout() } finally { setAuthed(false); setRole('') }
  }, [])

  return (
    <AuthCtx.Provider value={{ authed, ready, role, name, canWrite: authed && role !== 'auditor', login, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
