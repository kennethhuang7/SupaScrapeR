import { createContext, useContext, useEffect, useState } from 'react'
interface ThemeContextType {
  theme: 'light' | 'dark'
  fontSize: 'small' | 'medium' | 'large'
  toggleTheme: () => void
  setFontSize: (size: 'small' | 'medium' | 'large') => void
}
const ThemeContext = createContext<ThemeContextType | undefined>(undefined)
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium')
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'dark'
    const savedFontSize = localStorage.getItem('fontSize') as 'small' | 'medium' | 'large' || 'medium'
    setTheme(savedTheme)
    setFontSize(savedFontSize)
    applyTheme(savedTheme)
    applyFontSize(savedFontSize)
    if (window.electronAPI) {
      setTimeout(() => {
        window.electronAPI.send('theme-changed', savedTheme)
      }, 100)
    }
  }, [])
  const applyTheme = (newTheme: 'light' | 'dark') => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(newTheme)
  }
  const applyFontSize = (size: 'small' | 'medium' | 'large') => {
    const root = document.documentElement
    root.classList.remove('font-small', 'font-medium', 'font-large')
    if (size !== 'medium') {
      root.classList.add(`font-${size}`)
    }
  }
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    applyTheme(newTheme)
    if (window.electronAPI) {
      window.electronAPI.send('theme-changed', newTheme)
    }
  }
  const handleSetFontSize = (size: 'small' | 'medium' | 'large') => {
    setFontSize(size)
    localStorage.setItem('fontSize', size)
    applyFontSize(size)
  }
  return (
    <ThemeContext.Provider value={{ theme, fontSize, toggleTheme, setFontSize: handleSetFontSize }}>
      {children}
    </ThemeContext.Provider>
  )
}
export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}