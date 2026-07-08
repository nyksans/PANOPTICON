'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bell, BrainCircuit, Command, LogOut, User, Settings, ChevronDown, Zap, X } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useUser, useClerk } from '@clerk/nextjs';
import { mockAlerts } from '@/lib/mockData';
import { cn, initials, formatRelativeTime } from '@/lib/utils';
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher';

export function Header() {
  const { unreadCount, setGlobalSearchOpen, setAiPanelOpen, aiPanelOpen, markAllRead } = useUIStore();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const displayName = clerkUser?.fullName || clerkUser?.firstName || clerkUser?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'Analyst';
  const displayEmail = clerkUser?.emailAddresses?.[0]?.emailAddress || '';
  const [showNotif, setShowNotif] = useState(false);
  const [showUser, setShowUser]   = useState(false);

  const closeAll = () => { setShowNotif(false); setShowUser(false); };

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-5 gap-4 z-20"
      style={{ borderBottom:'1px solid var(--border)', background:'var(--bg-surface)', backdropFilter:'blur(12px)' }}>

      {/* Left: status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ boxShadow:'0 0 8px #00b4d8' }} />
          <span className="text-xs font-mono text-muted-foreground/60 tracking-widest">PANOPTICON v1.0</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-success/70">
          <Zap className="w-3.5 h-3.5" /> Operational
        </div>
      </div>

      {/* Center: search */}
      <button onClick={() => setGlobalSearchOpen(true)}
        className="hidden md:flex items-center gap-3 px-4 py-2 rounded-xl text-sm text-muted-foreground/60 transition-all duration-150 max-w-md w-full hover:text-muted-foreground"
        style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)' }}>
        <Search className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 text-left text-xs">Search cases, suspects, evidence…</span>
        <kbd className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background:'var(--bg-overlay)', border:'1px solid var(--border-bright)' }}>
          <Command className="w-2.5 h-2.5" />K
        </kbd>
      </button>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Theme Switcher */}
        <ThemeSwitcher />

        {/* AI Toggle */}
        <button onClick={() => setAiPanelOpen(!aiPanelOpen)}
          className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
            aiPanelOpen ? 'bg-accent/12 border-accent/30 text-accent' : 'border-white/8 text-muted-foreground hover:text-foreground hover:border-white/15')}>
          <BrainCircuit className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">AI Copilot</span>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button onClick={() => { setShowNotif(n => !n); setShowUser(false); }}
            className="relative w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            style={{ border:'1px solid transparent' }}>
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-danger" style={{ boxShadow:'0 0 6px #ef4444' }} />
            )}
          </button>
          <AnimatePresence>
            {showNotif && (
              <motion.div initial={{ opacity:0, y:6, scale:0.97 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:6, scale:0.97 }} transition={{ duration:0.13 }}
                className="absolute right-0 top-11 w-80 rounded-2xl overflow-hidden z-50 shadow-panel"
                style={{ background:'var(--bg-surface)', border:'1px solid var(--border-bright)', backdropFilter:'blur(24px)' }}>
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom:'1px solid var(--border)' }}>
                  <span className="text-sm font-semibold">Notifications</span>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && <button onClick={markAllRead} className="text-xs text-accent hover:text-accent-glow">Mark all read</button>}
                    <button onClick={closeAll} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {mockAlerts.map(alert => (
                    <div key={alert.id} className={cn('flex gap-3 px-4 py-3 cursor-pointer transition-colors', !alert.read && 'bg-accent/3')}
                      style={{ borderBottom:'1px solid var(--border)' }}>
                      <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                        alert.severity==='critical'?'bg-danger':alert.severity==='warning'?'bg-warning':'bg-accent')} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">{alert.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{alert.message}</p>
                        <p className="text-[10px] text-muted-foreground/40 mt-1">{formatRelativeTime(alert.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User menu */}
        <div className="relative">
          <button onClick={() => { setShowUser(u => !u); setShowNotif(false); }}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg transition-colors hover:bg-white/4">
            <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
              style={{ background:'linear-gradient(135deg,#1565c0,#00b4d8)' }}>
              {initials(displayName)}
            </div>
            <span className="hidden sm:block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{displayName.split(' ')[0]}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground/60" />
          </button>
          <AnimatePresence>
            {showUser && (
              <motion.div initial={{ opacity:0, y:6, scale:0.97 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:6, scale:0.97 }} transition={{ duration:0.13 }}
                className="absolute right-0 top-11 w-52 rounded-2xl overflow-hidden z-50 shadow-panel"
                style={{ background:'var(--bg-surface)', border:'1px solid var(--border-bright)', backdropFilter:'blur(24px)' }}>
                <div className="p-4" style={{ borderBottom:'1px solid var(--border)' }}>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{displayName}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{displayEmail}</p>
                  <span className="badge-info text-[10px] mt-2 inline-block capitalize">Investigator</span>
                </div>
                <div className="p-2">
                  {[{l:'Profile',i:User,h:'/settings'},{l:'Settings',i:Settings,h:'/settings'}].map(item=>{
                    const Icon = item.i;
                    return (
                      <button key={item.l} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors text-left">
                        <Icon className="w-3.5 h-3.5" />{item.l}
                      </button>
                    );
                  })}
                  <div className="my-1" style={{ borderTop:'1px solid var(--border)' }} />
                  <button onClick={() => signOut({ redirectUrl: '/auth/signin' })} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-danger hover:bg-danger/8 transition-colors text-left">
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {(showNotif || showUser) && <div className="fixed inset-0 z-40" onClick={closeAll} />}
    </header>
  );
}
