import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    // Check localStorage first, then system preference
    try {
      const savedTheme = localStorage.getItem('loomlance-theme')
      if (savedTheme) {
        return savedTheme
      }
    } catch (error) {
      console.error('Error reading theme from localStorage:', error)
    }
    
    // Fallback to system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    
    return 'light'
  })

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    
    // Save to localStorage with error handling
    try {
      localStorage.setItem('loomlance-theme', theme)
    } catch (error) {
      console.error('Error saving theme to localStorage:', error)
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }, [])

  const setLightTheme = useCallback(() => {
    setTheme('light')
  }, [])

  const setDarkTheme = useCallback(() => {
    setTheme('dark')
  }, [])

  const contextValue = useMemo(() => ({
    theme,
    toggleTheme,
    setLightTheme,
    setDarkTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light'
  }), [theme, toggleTheme, setLightTheme, setDarkTheme])

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

// Context selector hooks for specific theme data
export const useThemeValue = () => {
  const { theme } = useTheme()
  return theme
}

export const useIsDark = () => {
  const { isDark } = useTheme()
  return isDark
}

export const useThemeActions = () => {
  const { toggleTheme, setLightTheme, setDarkTheme } = useTheme()
  return { toggleTheme, setLightTheme, setDarkTheme }
}
