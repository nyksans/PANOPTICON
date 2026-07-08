'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { themes, densityModes, accentColors, ThemeName, DensityMode } from './themes'

interface ThemeContextType {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
  density: DensityMode
  setDensity: (density: DensityMode) => void
  accent: string
  setAccent: (accent: string) => void
  fontScale: number
  setFontScale: (scale: number) => void
  colors: (typeof themes)[ThemeName]['colors']
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>('dark')
  const [density, setDensity] = useState<DensityMode>('comfortable')
  const [accent, setAccent] = useState(accentColors[0])
  const [fontScale, setFontScale] = useState(1)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('panopticon-theme')
    if (saved && saved in themes) {
      setTheme(saved as ThemeName)
    }
    
    const savedDensity = localStorage.getItem('panopticon-density')
    if (savedDensity && savedDensity in densityModes) {
      setDensity(savedDensity as DensityMode)
    }
    
    const savedAccent = localStorage.getItem('panopticon-accent')
    if (savedAccent && accentColors.includes(savedAccent)) {
      setAccent(savedAccent)
    }
    
    const savedFontScale = localStorage.getItem('panopticon-font-scale')
    if (savedFontScale) {
      setFontScale(parseFloat(savedFontScale))
    }
    
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    localStorage.setItem('panopticon-theme', theme)
  }, [theme, mounted])

  useEffect(() => {
    if (!mounted) return
    localStorage.setItem('panopticon-density', density)
  }, [density, mounted])

  useEffect(() => {
    if (!mounted) return
    localStorage.setItem('panopticon-accent', accent)
  }, [accent, mounted])

  useEffect(() => {
    if (!mounted) return
    localStorage.setItem('panopticon-font-scale', fontScale.toString())
  }, [fontScale, mounted])

  const themeObj = themes[theme]

  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    Object.entries(themeObj.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value)
    })
    
    root.style.setProperty('--accent-color', accent)
    root.style.setProperty('--font-scale', fontScale.toString())
    root.style.setProperty('--density-spacing', densityModes[density].spacing.toString())
  }, [theme, accent, fontScale, density, mounted])

  if (!mounted) return <>{children}</>

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        density,
        setDensity,
        accent,
        setAccent,
        fontScale,
        setFontScale,
        colors: themeObj.colors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
