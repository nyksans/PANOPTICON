'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, TrendingUp, AlertTriangle, Lock, BarChart3, Zap,
  Clock, Activity, Target, Brain, Map, Database, Command,
  Bell, Settings, Maximize2, ChevronRight, Search, Download, X
} from 'lucide-react'
import { casesAPI } from '@/lib/api'
import { toast } from 'sonner'
import Link from 'next/link'
import { CaseCard } from '@/components/cases/CaseCard'
import { PageLoadingSkeleton, Skeleton } from '@/components/ui/LoadingSkeleton'
import type { Case } from '@/types'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
}

interface CaseStats {
  total: number
  open: number
  critical: number
  archived: number
  avgTime: number
  aiQueue: number
}

interface NewCaseForm {
  title: string
  description: string
  priority: string
  category: string
  location: string
  incident_date: string
  tags: string
}

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [stats, setStats] = useState<CaseStats>({
    total: 0,
    open: 0,
    critical: 0,
    archived: 0,
    avgTime: 0,
    aiQueue: 0,
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<NewCaseForm>({
    title: '',
    description: '',
    priority: 'high',
    category: 'investigation',
    location: '',
    incident_date: new Date().toISOString().slice(0, 16),
    tags: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const response = await casesAPI.list(1, 50)
      const allCases = response.data.data || []
      
      const mappedCases = allCases.map((c: any) => ({
        id: c.id,
        caseNumber: c.case_number || c.id.slice(0,8),
        title: c.title,
        description: c.description || '',
        status: c.status,
        priority: c.priority,
        category: c.category || 'general',
        location: c.location || 'Unknown',
        incidentDate: c.incident_date || new Date().toISOString(),
        tags: c.tags || [],
        assignedTo: c.assigned_to || [],
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        evidenceCount: c.evidence_count || 0,
        suspects: 0,
        aiProcessed: true,
        confidenceScore: 0.95,
        createdBy: c.created_by || 'system'
      }));

      setCases(mappedCases)

      setStats({
        total: mappedCases.length,
        open: mappedCases.filter((c: any) => c.status === 'open').length,
        critical: mappedCases.filter((c: any) => c.priority === 'critical').length,
        archived: mappedCases.filter((c: any) => c.status === 'archived').length,
        avgTime: Math.floor(Math.random() * 30) + 5,
        aiQueue: Math.floor(Math.random() * 12),
      })
    } catch (error: any) {
      toast.error('Failed to load investigations')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error('Case title is required')
      return
    }
    try {
      setCreating(true)
      await casesAPI.create({
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        category: form.category,
        location: form.location.trim() || 'Unknown',
        incident_date: form.incident_date ? new Date(form.incident_date).toISOString() : new Date().toISOString(),
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        assigned_to: [],
        created_by: '',
      })
      toast.success('Investigation created successfully!')
      setShowModal(false)
      setForm({
        title: '',
        description: '',
        priority: 'high',
        category: 'investigation',
        location: '',
        incident_date: new Date().toISOString().slice(0, 16),
        tags: '',
      })
      loadData()
    } catch (error: any) {
      console.error('Create case error:', error)
      toast.error(error?.message || 'Failed to create investigation')
    } finally {
      setCreating(false)
    }
  }

  const filteredCases = cases.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.caseNumber.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* New Investigation Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-surface/50">
                <div>
                  <h2 className="text-lg font-bold text-foreground">New Investigation</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Create a new forensic investigation case</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-lg hover:bg-surface-raised text-muted-foreground hover:text-foreground transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleCreateCase} className="p-6 space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Case Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Operation Blue Star - Financial Fraud"
                    className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Brief description of the investigation..."
                    className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition resize-none"
                  />
                </div>

                {/* Row: Priority + Category */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Priority</label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                    >
                      <option value="investigation">Investigation</option>
                      <option value="cybercrime">Cybercrime</option>
                      <option value="fraud">Financial Fraud</option>
                      <option value="narcotics">Narcotics</option>
                      <option value="terrorism">Terrorism</option>
                      <option value="homicide">Homicide</option>
                      <option value="trafficking">Trafficking</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Row: Location + Incident Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Location</label>
                    <input
                      type="text"
                      value={form.location}
                      onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
                      placeholder="e.g. Mumbai, Maharashtra"
                      className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Incident Date</label>
                    <input
                      type="datetime-local"
                      value={form.incident_date}
                      onChange={(e) => setForm(f => ({ ...f, incident_date: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                    />
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Tags</label>
                  <input
                    type="text"
                    value={form.tags}
                    onChange={(e) => setForm(f => ({ ...f, tags: e.target.value }))}
                    placeholder="fraud, mumbai, cyber (comma-separated)"
                    className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Separate tags with commas</p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-surface-raised border border-border transition"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={creating || !form.title.trim()}
                    className="px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground rounded-lg text-sm font-semibold transition-all shadow-sm flex items-center gap-2"
                  >
                    {creating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Create Investigation
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-40"
        >
          <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Investigations</h1>
              <p className="text-sm text-muted-foreground mt-1">Active forensic intelligence workspace</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 bg-surface rounded-lg px-3 py-2 border border-border">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search investigations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none"
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-primary-foreground font-medium transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                New Investigation
              </motion.button>
            </div>
          </div>
        </motion.header>

        {/* Stats Row */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="px-6 py-4 grid grid-cols-2 md:grid-cols-6 gap-3 max-w-7xl mx-auto"
        >
          {[
            { icon: Target, label: 'Total', value: stats.total, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { icon: AlertTriangle, label: 'Open', value: stats.open, color: 'text-orange-500', bg: 'bg-orange-500/10' },
            { icon: Lock, label: 'Critical', value: stats.critical, color: 'text-red-500', bg: 'bg-red-500/10' },
            { icon: Clock, label: 'Archive', value: stats.archived, color: 'text-slate-500', bg: 'bg-slate-500/10' },
            { icon: TrendingUp, label: 'Avg Time', value: `${stats.avgTime}h`, color: 'text-green-500', bg: 'bg-green-500/10' },
            { icon: Zap, label: 'AI Queue', value: stats.aiQueue, color: 'text-purple-500', bg: 'bg-purple-500/10' },
          ].map((stat, i) => {
            const Icon = stat.icon
            return (
              <motion.div
                key={i}
                variants={itemVariants}
                className={`rounded-xl p-4 shadow-sm border border-border bg-card flex flex-col`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{stat.label}</span>
                  <div className={`p-1.5 rounded-md ${stat.bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${stat.color}`} />
                  </div>
                </div>
                <div className="text-2xl font-bold tabular-nums text-foreground">{stat.value}</div>
              </motion.div>
            )
          })}
        </motion.div>

        {/* Main Content Grid */}
        <div className="px-6 py-4 grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {/* Left: Cases List */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="lg:col-span-3 space-y-4"
          >
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ) : filteredCases.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card rounded-xl border border-border p-12 text-center"
              >
                <Database className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Investigations Found</h3>
                <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">Get started by creating a new investigation case or importing existing records.</p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowModal(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-medium transition"
                >
                  Create Investigation
                </motion.button>
              </motion.div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredCases.map((caseItem: Case) => (
                  <CaseCard key={caseItem.id} case={caseItem} view="grid" />
                ))}
              </div>
            )}
          </motion.div>

          {/* Right: Intelligence Sidebar */}
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-4 lg:col-span-1"
          >
            {/* Quick Actions */}
            <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <motion.button
                  whileHover={{ x: 2 }}
                  onClick={() => setShowModal(true)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-surface-raised text-sm text-foreground transition text-left border border-transparent hover:border-border"
                >
                  <Plus className="w-4 h-4 text-primary" />
                  New Investigation
                </motion.button>
                <motion.button
                  whileHover={{ x: 2 }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-surface-raised text-sm text-foreground transition text-left border border-transparent hover:border-border"
                >
                  <Download className="w-4 h-4 text-success" />
                  Export Cases
                </motion.button>
                <motion.button
                  whileHover={{ x: 2 }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-surface-raised text-sm text-foreground transition text-left border border-transparent hover:border-border"
                >
                  <BarChart3 className="w-4 h-4 text-accent" />
                  Generate Report
                </motion.button>
              </div>
            </div>

            {/* AI Status */}
            <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">AI Copilot</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">System is ready to assist with pattern recognition and evidence analysis across all cases.</p>
              <Link href="/ai-assistant">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full px-3 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition shadow-sm"
                >
                  Open Copilot
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
