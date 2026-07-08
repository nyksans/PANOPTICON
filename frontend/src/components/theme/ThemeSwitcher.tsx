'use client';

import { useState, useEffect } from 'react';
import { THEMES, getTheme, setTheme as applyTheme, type Theme } from '@/lib/theme';
import { Palette, Check, X } from 'lucide-react';

export function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState<Theme>('dark');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setCurrentTheme(getTheme());
  }, []);

  const handleThemeChange = (theme: Theme) => {
    applyTheme(theme);
    setCurrentTheme(theme);
    setOpen(false);
  };

  const currentConfig = THEMES.find(t => t.id === currentTheme);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title="Change Theme"
        className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm font-medium"
        style={{
          background: 'var(--bg-elevated)',
          borderColor: 'var(--border-bright)',
          color: 'var(--text-primary)',
        }}
      >
        <span className="text-base leading-none">{currentConfig?.icon}</span>
        <span className="hidden sm:inline" style={{ color: 'var(--text-secondary)' }}>
          {currentConfig?.name}
        </span>
        <Palette className="w-4 h-4" style={{ color: 'var(--accent)' }} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div
            className="absolute right-0 top-12 z-50 w-72 rounded-2xl shadow-2xl border p-3"
            style={{
              background: 'var(--bg-surface)',
              borderColor: 'var(--border-bright)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Appearance
                </span>
              </div>
              <button onClick={() => setOpen(false)} style={{ color: 'var(--text-dim)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              {THEMES.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => handleThemeChange(theme.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group"
                  style={{
                    background: currentTheme === theme.id ? 'var(--accent-dim)' : 'transparent',
                    borderLeft: currentTheme === theme.id ? '2px solid var(--accent)' : '2px solid transparent',
                  }}
                >
                  <span className="text-xl">{theme.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {theme.name}
                    </div>
                    <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {theme.description}
                    </div>
                  </div>
                  {currentTheme === theme.id && (
                    <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
