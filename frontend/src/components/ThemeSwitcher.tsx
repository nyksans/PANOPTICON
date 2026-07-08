'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Palette, Moon, Sun, Maximize2 } from 'lucide-react'
import { useState } from 'react'
import { useTheme } from '@/theme/ThemeContext'
import { themes, densityModes, accentColors } from '@/theme/themes'

export function ThemeSwitcher() {
  const [open, setOpen] = useState(false)
  const { theme, setTheme, density, setDensity, accent, setAccent, fontScale, setFontScale } = useTheme()

  return (
    <div className="relative">
      <motion.button
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
      >
        <Palette className="w-5 h-5" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute right-0 top-12 bg-slate-900 border border-slate-700 rounded-lg p-4 w-64 shadow-xl z-50"
          >
            <h3 className="text-sm font-medium text-white mb-3">Appearance</h3>

            {/* Theme */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-2 block">Theme</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(themes).slice(0, 4).map(([key, value]) => (
                  <motion.button
                    key={key}
                    onClick={() => setTheme(key as any)}
                    className={`p-2 rounded text-xs font-medium transition ${
                      theme === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {value.name}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Density */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-2 block flex items-center gap-1">
                <Maximize2 className="w-3 h-3" /> Density
              </label>
              <div className="flex gap-2">
                {Object.entries(densityModes).map(([key, value]) => (
                  <motion.button
                    key={key}
                    onClick={() => setDensity(key as any)}
                    className={`flex-1 p-2 rounded text-xs font-medium transition ${
                      density === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Accent */}
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Accent Color</label>
              <div className="grid grid-cols-4 gap-2">
                {accentColors.map((color) => (
                  <motion.button
                    key={color}
                    onClick={() => setAccent(color)}
                    className={`w-full h-8 rounded transition ${
                      accent === color ? 'ring-2 ring-white' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
