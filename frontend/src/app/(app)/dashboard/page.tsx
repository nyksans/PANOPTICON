'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Shield,
  Film,
  Users,
  FileText,
  BrainCircuit,
  AlertTriangle,
  TrendingUp,
  Target,
} from 'lucide-react';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { RecentCases } from '@/components/dashboard/RecentCases';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { SystemHealth } from '@/components/dashboard/SystemHealth';
import { dashboardApi, casesApi, toCaseFrontend } from '@/lib/api';
import { formatTimestamp } from '@/lib/utils';
import type { Case } from '@/types';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function DashboardPage() {
  const { data: statsData } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.stats(),
    refetchInterval: 30_000,
  });

  const { data: casesData } = useQuery({
    queryKey: ['cases', 'dashboard'],
    queryFn: () => casesApi.list({ page: 1, page_size: 10, status: 'active' }),
  });

  const { data: alertsData } = useQuery({
    queryKey: ['dashboard-alerts'],
    queryFn: () => dashboardApi.alerts(),
    refetchInterval: 60_000,
  });

  const stats = statsData?.data ?? {
    activeCases: 0, totalEvidence: 0, processingQueue: 0, alertsToday: 0,
    suspectsTracked: 0, reportsGenerated: 0, aiAccuracy: 0, systemHealth: 'operational' as const,
  };
  const activeCases: Case[] = (casesData?.data ?? []).map(toCaseFrontend);
  const criticalAlerts = (alertsData?.data ?? []).filter((a) => a.severity === 'critical' && !a.read);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-4 rounded-full bg-accent" />
            <span className="text-xs font-semibold text-accent tracking-widest uppercase">
              Operations Center
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatTimestamp(new Date().toISOString(), 'EEEE, dd MMMM yyyy — HH:mm')} UTC
          </p>
        </div>

        {criticalAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-danger/10 border border-danger/30"
          >
            <AlertTriangle className="w-4 h-4 text-danger" />
            <span className="text-sm font-medium text-danger">
              {criticalAlerts.length} Critical Alert{criticalAlerts.length > 1 ? 's' : ''}
            </span>
          </motion.div>
        )}
      </motion.div>

      {/* Stats grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <motion.div variants={itemVariants}>
          <StatsCard
            title="Active Cases"
            value={stats.activeCases}
            icon={Shield}
            variant="accent"
            trend={{ value: 12, label: 'this week' }}
            subtitle="Across all departments"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatsCard
            title="Evidence Items"
            value={stats.totalEvidence}
            icon={Film}
            variant="default"
            trend={{ value: 8, label: 'today' }}
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatsCard
            title="Suspects Tracked"
            value={stats.suspectsTracked}
            icon={Users}
            variant="warning"
            subtitle="Cross-camera re-ID active"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatsCard
            title="AI Accuracy"
            value={`${stats.aiAccuracy}%`}
            icon={BrainCircuit}
            variant="success"
            trend={{ value: 2.3, label: 'vs last month' }}
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatsCard
            title="Processing Queue"
            value={stats.processingQueue}
            icon={Target}
            variant="default"
            subtitle="~14 min avg. completion"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatsCard
            title="Reports Generated"
            value={stats.reportsGenerated}
            icon={FileText}
            variant="default"
            trend={{ value: 5, label: 'this week' }}
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatsCard
            title="Alerts Today"
            value={stats.alertsToday}
            icon={AlertTriangle}
            variant={stats.alertsToday > 5 ? 'danger' : 'warning'}
            subtitle="2 critical, 1 informational"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatsCard
            title="Detection Rate"
            value="94.2%"
            icon={TrendingUp}
            variant="success"
            trend={{ value: 1.8, label: 'vs last week' }}
          />
        </motion.div>
      </motion.div>

      {/* Critical alert banner */}
      {criticalAlerts.map((alert) => (
        <motion.div
          key={alert.id}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 p-4 rounded-xl bg-danger/8 border border-danger/25"
        >
          <div className="w-9 h-9 rounded-lg bg-danger/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-danger" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-danger">{alert.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
          </div>
          <button className="text-xs text-danger/70 hover:text-danger border border-danger/20 hover:border-danger/40 px-3 py-1.5 rounded-lg transition-colors">
            Investigate
          </button>
        </motion.div>
      ))}

      {/* Main content grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* Cases table — 2 cols */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <RecentCases cases={activeCases} />
        </motion.div>

        {/* Activity feed — 1 col */}
        <motion.div variants={itemVariants}>
          <ActivityFeed />
        </motion.div>

        {/* System health — 1 col */}
        <motion.div variants={itemVariants}>
          <SystemHealth />
        </motion.div>

        {/* AI Processing Summary — 2 cols */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <AIProcessingSummary />
        </motion.div>
      </motion.div>
    </div>
  );
}

// Mini AI Processing Summary component
function AIProcessingSummary() {
  const recentJobs = [
    {
      id: 'job-001',
      case: 'PAN-2026-0039',
      file: 'Drone Survey Port Zone B',
      status: 'completed',
      duration: '6h 12m',
      objects: 847,
      persons: 6,
      confidence: 91,
    },
    {
      id: 'job-002',
      case: 'PAN-2026-0047',
      file: 'Station Camera 4',
      status: 'completed',
      duration: '45m',
      objects: 124,
      persons: 8,
      confidence: 92,
    },
    {
      id: 'job-003',
      case: 'PAN-2026-0052',
      file: 'Body Camera Rodriguez',
      status: 'processing',
      duration: 'running...',
      objects: 0,
      persons: 0,
      confidence: 0,
    },
    {
      id: 'job-004',
      case: 'PAN-2026-0043',
      file: 'Riverside Gate Camera',
      status: 'queued',
      duration: 'queued',
      objects: 0,
      persons: 0,
      confidence: 0,
    },
  ];

  return (
    <div className="card-panel rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <BrainCircuit className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-semibold">AI Processing Pipeline</h2>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <span className="text-xs text-accent/80">Live</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              {['Case', 'Evidence File', 'Status', 'Duration', 'Detections', 'Confidence'].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-2xs font-semibold text-muted-foreground uppercase tracking-wider"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {recentJobs.map((job) => (
              <tr key={job.id} className="data-row">
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-muted-foreground">{job.case}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-foreground">{job.file}</span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      job.status === 'completed'
                        ? 'badge-active'
                        : job.status === 'processing'
                          ? 'badge-info'
                          : 'text-xs text-muted-foreground border border-border px-2 py-0.5 rounded'
                    }
                  >
                    {job.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono tabular-nums text-muted-foreground">
                    {job.duration}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {job.status === 'completed' ? (
                    <span className="text-xs text-muted-foreground">
                      {job.objects} obj · {job.persons} persons
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {job.status === 'completed' ? (
                    <div className="flex items-center gap-2">
                      <div className="confidence-bar w-16">
                        <div
                          className={
                            job.confidence >= 85
                              ? 'confidence-fill bg-success'
                              : job.confidence >= 70
                                ? 'confidence-fill bg-warning'
                                : 'confidence-fill bg-accent'
                          }
                          style={{ width: `${job.confidence}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono tabular-nums">{job.confidence}%</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
