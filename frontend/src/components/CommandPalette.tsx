'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Command, Plus, Settings, Moon, Sun, Eye } from 'lucide-react'
import { useTheme } from '@/theme/ThemeContext'
import { themes, densityModes, accentColors } from '@/theme/themes'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { theme, setTheme, density, setDensity, accent, setAccent } = useTheme()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(!open)
        setSearch('')
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const commands = [
    { label: 'New Investigation', icon: Plus, action: () => {} },
    { label: 'Settings', icon: Settings, action: () => {} },
    ...Object.entries(themes).map(([key, value]) => ({
      label: `Theme: ${value.name}`,
      icon: Moon,
      action: () => setTheme(key as any),
    })),
  ]

  const filteredCommands = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg"
          >
            <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
                <Search className="w-5 h-5 text-slate-500" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search commands..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent text-white outline-none text-sm"
                />
                <span className="text-xs text-slate-500">ESC</span>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {filteredCommands.map((cmd, i) => {
                  const Icon = cmd.icon
                  return (
                    <motion.button
                      key={i}
                      onClick={() => {
                        cmd.action()
                        setOpen(false)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 transition text-left text-sm text-slate-200 border-b border-slate-800 last:border-0"
                    >
                      <Icon className="w-4 h-4 text-slate-600" />
                      <span className="flex-1">{cmd.label}</span>
                      <span className="text-xs text-slate-600">⏎</span>
                    </motion.button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cmd+K button */}
      <motion.button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition text-sm"
      >
        <Command className="w-4 h-4" />
        <span>Cmd+K</span>
      </motion.button>
    </>
  )
}
