'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  FolderOpen,
} from 'lucide-react';
import { CaseCard } from '@/components/cases/CaseCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { CaseCardSkeleton } from '@/components/ui/LoadingSkeleton';
import { casesApi, toCaseFrontend } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Case, CaseStatus, CasePriority } from '@/types';

type ViewMode = 'grid' | 'list';
type SortField = 'updatedAt' | 'createdAt' | 'priority' | 'evidenceCount';

const statusOptions: { value: CaseStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
];

const priorityOptions: { value: CasePriority | 'all'; label: string }[] = [
  { value: 'all', label: 'All Priority' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const sortOptions: { value: SortField; label: string }[] = [
  { value: 'updatedAt', label: 'Last Updated' },
  { value: 'createdAt', label: 'Date Created' },
  { value: 'priority', label: 'Priority' },
  { value: 'evidenceCount', label: 'Evidence Count' },
];

const priorityOrder: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export default function CasesPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<CasePriority | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortField>('updatedAt');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: casesData, isLoading } = useQuery({
    queryKey: ['cases', statusFilter, priorityFilter, search],
    queryFn: () =>
      casesApi.list({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        search: search.trim() || undefined,
        page_size: 100,
      }),
    staleTime: 15_000,
  });

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof casesApi.create>[0]) => casesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      toast.success('Case created successfully');
      setShowCreateModal(false);
    },
    onError: () => toast.error('Failed to create case'),
  });

  const allCases: Case[] = useMemo(
    () => (casesData?.data ?? []).map(toCaseFrontend),
    [casesData],
  );

  const filtered = useMemo(() => {
    let list = [...allCases];
    list.sort((a, b) => {
      switch (sortBy) {
        case 'updatedAt':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'createdAt':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'priority':
          return (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
        case 'evidenceCount':
          return b.evidenceCount - a.evidenceCount;
        default:
          return 0;
      }
    });
    return list;
  }, [allCases, sortBy]);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-4 rounded-full bg-accent" />
            <span className="text-xs font-semibold text-accent tracking-widest uppercase">
              Case Management
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Investigations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} of {casesData?.total ?? 0} cases
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground font-medium text-sm hover:bg-accent-glow transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Case
        </button>
      </motion.div>

      {/* Filters bar */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex items-center gap-3 flex-wrap"
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search cases, locations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CaseStatus | 'all')}
          className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:border-accent/50 cursor-pointer"
        >
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#0D1526]">
              {o.label}
            </option>
          ))}
        </select>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as CasePriority | 'all')}
          className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:border-accent/50 cursor-pointer"
        >
          {priorityOptions.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#0D1526]">
              {o.label}
            </option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortField)}
          className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:border-accent/50 cursor-pointer"
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#0D1526]">
              Sort: {o.label}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setView('grid')}
            className={cn(
              'p-2 transition-colors',
              view === 'grid' ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('list')}
            className={cn(
              'p-2 transition-colors border-l border-border',
              view === 'list' ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* Cases display */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <CaseCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No cases found"
          description="Try adjusting your search or filter criteria."
        />
      ) : view === 'grid' ? (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
          }}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {filtered.map((c) => (
            <motion.div
              key={c.id}
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: { opacity: 1, y: 0 },
              }}
            >
              <CaseCard case={c} view="grid" />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card-panel rounded-xl overflow-hidden"
        >
          {/* List header */}
          <div className="grid grid-cols-[1fr_auto] border-b border-border px-4 py-3">
            <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
              Case Details
            </span>
            <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
              Stats
            </span>
          </div>
          {filtered.map((c) => (
            <CaseCard key={c.id} case={c} view="list" />
          ))}
        </motion.div>
      )}

      {/* Create Case Modal */}
      {showCreateModal && (
        <CreateCaseModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={(payload) => createMutation.mutate(payload)}
          isSubmitting={createMutation.isPending}
        />
      )}
    </div>
  );
}

// Create Case Modal
function CreateCaseModal({
  onClose,
  onSubmit,
  isSubmitting,
}: {
  onClose: () => void;
  onSubmit: (payload: import('@/types').CreateCasePayload) => void;
  isSubmitting: boolean;
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'high',
    category: '',
    location: '',
    incidentDate: '',
  });

  const handleCreate = () => {
    if (!form.title || !form.location || !form.incidentDate) return;
    onSubmit({
      title: form.title,
      description: form.description,
      priority: form.priority as import('@/types').CasePriority,
      category: form.category,
      location: form.location,
      incidentDate: new Date(form.incidentDate).toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="w-full max-w-lg glass-strong rounded-2xl border border-border shadow-panel overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-base font-semibold">New Investigation</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Create a new forensic investigation case
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Case Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Armed Robbery – Central Mall"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2.5 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Priority *
              </label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full px-3 py-2.5 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:border-accent/50 cursor-pointer"
              >
                <option value="critical" className="bg-[#0D1526]">Critical</option>
                <option value="high" className="bg-[#0D1526]">High</option>
                <option value="medium" className="bg-[#0D1526]">Medium</option>
                <option value="low" className="bg-[#0D1526]">Low</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Category
              </label>
              <input
                type="text"
                placeholder="e.g. Robbery, Homicide"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2.5 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Incident Location *
            </label>
            <input
              type="text"
              placeholder="e.g. Central Station, Platform 4"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full px-3 py-2.5 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Incident Date & Time *
            </label>
            <input
              type="datetime-local"
              value={form.incidentDate}
              onChange={(e) => setForm({ ...form, incidentDate: e.target.value })}
              className="w-full px-3 py-2.5 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 [color-scheme:dark]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Description
            </label>
            <textarea
              placeholder="Brief description of the incident..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2.5 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!form.title || !form.location || !form.incidentDate || isSubmitting}
            className="px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg hover:bg-accent-glow transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create Investigation'}
          </button>
        </div>
      </motion.div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
