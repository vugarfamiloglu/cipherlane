import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api'

interface AuthState {
  authed: boolean
  ready: boolean
  login: (passcode: string, code?: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthCtx = createContext<AuthState>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    api.me()
      .then((r) => setAuthed(r.authenticated))
      .catch(() => setAuthed(false))
      .finally(() => setReady(true))
  }, [])

  const login = useCallback(async (passcode: string, code?: string) => {
    const r = await api.login(passcode, code)
    setAuthed(r.authenticated)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      setAuthed(false)
    }
  }, [])

  return <AuthCtx.Provider value={{ authed, ready, login, logout }}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
