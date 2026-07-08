'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, FolderOpen, Film, Search,
  BrainCircuit, FileText, Settings, ChevronLeft,
  Eye, Zap, Activity, Users, Radio, Database, BookOpen
} from 'lucide-react';
import { cn, initials } from '@/lib/utils';
import { useUIStore } from '@/store/uiStore';
import { useUser } from '@clerk/nextjs';

const NAV = [
  {
    label: 'Operations',
    items: [
      { href: '/dashboard',    label: 'Dashboard',      icon: LayoutDashboard },
      { href: '/prebuilt-cases', label: 'Case Library', icon: BookOpen, badge: 'IN' },
      { href: '/cases',        label: 'Cases',          icon: FolderOpen      },
      { href: '/evidence',     label: 'Evidence',       icon: Film            },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/investigation',label: 'Investigation',  icon: Search          },
      { href: '/ai-assistant', label: 'AI Copilot',     icon: BrainCircuit, badge: 'AI' },
      { href: '/tracking',     label: 'Live Tracking',  icon: Activity        },
      { href: '/reports',      label: 'Reports',        icon: FileText        },
    ],
  },
  {
    label: 'Data',
    items: [
      { href: '/datasets',     label: 'Datasets',       icon: Database, badge: 'EDA' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/settings',     label: 'Settings',       icon: Settings        },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { user: clerkUser } = useUser();
  const displayName = clerkUser?.fullName || clerkUser?.firstName || clerkUser?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'Analyst';
  const displayRole = (clerkUser?.publicMetadata?.role as string) || 'Investigator';

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 60 : 220 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex flex-col h-full shrink-0 overflow-hidden z-30"
      style={{ background: 'var(--bg-base)', borderRight: '1px solid var(--border)' }}
    >
      {/* ── Logo ── */}
      <div className="flex items-center h-14 px-3.5 shrink-0 gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="relative shrink-0 w-8 h-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00b4d8, #1565c0)' }}>
            <Eye className="w-4 h-4 text-white" />
          </div>
          <div className="absolute inset-0 rounded-lg opacity-40 blur-lg" style={{ background: 'linear-gradient(135deg, #00b4d8, #1565c0)' }} />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-8 }} transition={{ duration:0.12 }} className="overflow-hidden">
              <p className="text-sm font-bold tracking-widest text-gradient-cyan leading-none">PANOPTICON</p>
              <p className="text-[9px] text-muted-foreground/50 tracking-[0.25em] mt-0.5">FORENSIC INTEL</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 no-scrollbar">
        {NAV.map((group) => (
          <div key={group.label} className="mb-4">
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                  className="px-3.5 mb-1.5 text-[9px] font-semibold tracking-[0.2em] text-muted-foreground/40 uppercase">
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>
            {group.items.map((item) => {
              const Icon    = item.icon;
              const active  = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link key={item.href} href={item.href}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={cn(
                    'relative flex items-center gap-3 mx-2 mb-0.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150 cursor-pointer group',
                    active
                      ? 'text-accent bg-accent/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/4',
                    sidebarCollapsed && 'justify-center px-0',
                  )}
                >
                  {active && (
                    <motion.div layoutId="nav-pill"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-accent"
                      transition={{ type:'spring', bounce:0.25, duration:0.4 }} />
                  )}
                  <Icon className={cn('w-4 h-4 shrink-0 transition-colors', active ? 'text-accent' : 'text-muted-foreground/70 group-hover:text-muted-foreground')} />
                  <AnimatePresence>
                    {!sidebarCollapsed && (
                      <motion.div initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-6 }} transition={{ duration:0.1 }}
                        className="flex items-center justify-between flex-1 overflow-hidden">
                        <span className="whitespace-nowrap font-medium text-sm">{item.label}</span>
                        {'badge' in item && item.badge && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold tracking-wider bg-accent/15 text-accent border border-accent/25">{item.badge}</span>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── System status chip ── */}
      <AnimatePresence>
        {!sidebarCollapsed && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="mx-3 mb-3 p-2.5 rounded-xl border border-success/15 bg-success/5">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" style={{ boxShadow:'0 0 6px #22c55e' }} />
              <span className="text-[9px] font-bold tracking-widest text-success/70 uppercase">All Systems Live</span>
            </div>
            {[['AI Pipeline','●'],['Queue','4 jobs'],['Latency','2ms']].map(([k,v])=>(
              <div key={k} className="flex justify-between">
                <span className="text-[10px] text-muted-foreground/50">{k}</span>
                <span className="text-[10px] text-success/60 font-mono">{v}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── User row ── */}
      <div style={{ borderTop:'1px solid var(--border)' }} className="p-3 shrink-0">
        <div className={cn('flex items-center gap-2.5', sidebarCollapsed && 'justify-center')}>
          <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
            style={{ background:'linear-gradient(135deg,#1565c0,#00b4d8)' }}>
            {initials(displayName)}
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-6 }} className="flex-1 overflow-hidden min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{displayName}</p>
                <p className="text-[10px] capitalize truncate" style={{ color: 'var(--text-dim)' }}>{displayRole}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Collapse toggle ── */}
      <button onClick={toggleSidebar}
        className="absolute -right-3 top-14 w-6 h-6 rounded-full border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors z-50"
        style={{ background:'var(--bg-elevated)' }}
        aria-label={sidebarCollapsed ? 'Expand' : 'Collapse'}>
        <motion.div animate={{ rotate: sidebarCollapsed ? 180 : 0 }} transition={{ duration:0.2 }}>
          <ChevronLeft className="w-3 h-3" />
        </motion.div>
      </button>
    </motion.aside>
  );
}
