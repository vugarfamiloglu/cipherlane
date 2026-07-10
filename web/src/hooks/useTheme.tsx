import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'
interface ThemeState { theme: Theme; toggle: () => void; set: (t: Theme) => void }

const ThemeCtx = createContext<ThemeState>({ theme: 'dark', toggle: () => {}, set: () => {} })

function initialTheme(): Theme {
  const saved = localStorage.getItem('cl-theme')
  if (saved === 'light' || saved === 'dark') return saved
  // Default to the night drafting-table for a monitoring console; respect an
  // explicit light OS preference.
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('cl-theme', theme)
  }, [theme])

  return (
    <ThemeCtx.Provider value={{ theme, set: setTheme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export const useTheme = () => useContext(ThemeCtx)
