import { useEffect, useState } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light')
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('loomlance-theme', theme)
    } catch {}
  }, [theme])
  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  return { theme, toggle }
}
