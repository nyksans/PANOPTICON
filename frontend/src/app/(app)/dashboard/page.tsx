'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { RecentCases } from '@/components/dashboard/RecentCases';
import { SystemHealth } from '@/components/dashboard/SystemHealth';
import { DetectionChart } from '@/components/dashboard/DetectionChart';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { FileText, Activity, Clock, ShieldAlert } from 'lucide-react';
import { casesAPI } from '@/lib/api';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/LoadingSkeleton';

export default function DashboardPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, open: 0, critical: 0, pending: 0 });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const res = await casesAPI.list(1, 10);
      const data = res.data.data || [];
      
      const mappedCases = data.map((c: any) => ({
        id: c.id,
        caseNumber: c.case_number || c.id.slice(0,8),
        title: c.title,
        status: c.status,
        priority: c.priority,
        location: c.location || 'Unknown',
        updatedAt: c.updated_at || new Date().toISOString(),
        evidenceCount: c.evidence_count || 0,
        suspects: 0,
        aiProcessed: true,
        confidenceScore: 0.95,
        createdBy: c.created_by || 'system'
      }));
      setCases(mappedCases);

      setStats({
        total: data.length,
        open: data.filter((c: any) => c.status === 'open').length,
        critical: data.filter((c: any) => c.priority === 'critical').length,
        pending: data.filter((c: any) => c.status === 'pending' || c.status === 'open').length
      });
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <Skeleton className="h-32 mb-6" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title="Command Center"
        subtitle="Real-time forensic intelligence and case oversight"
      />

      <main className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          <StatsCard
            title="Total Cases"
            value={stats.total}
            icon={FileText}
            variant="default"
            trend={{ value: 12, label: 'vs last month' }}
          />
          <StatsCard
            title="Active Investigations"
            value={stats.open}
            icon={Activity}
            variant="accent"
            trend={{ value: 5, label: 'new this week' }}
          />
          <StatsCard
            title="Critical Priority"
            value={stats.critical}
            icon={ShieldAlert}
            variant="danger"
            subtitle="Requires immediate attention"
          />
          <StatsCard
            title="Pending Review"
            value={stats.pending}
            icon={Clock}
            variant="warning"
            trend={{ value: -2, label: 'cleared today' }}
          />
        </motion.div>

        {/* Main Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid gap-6 lg:grid-cols-3"
        >
          <div className="lg:col-span-2 space-y-6">
            <DetectionChart />
            <RecentCases cases={cases} />
          </div>
          <div className="space-y-6">
            <SystemHealth />
            <ActivityFeed />
          </div>
        </motion.div>
      </main>
    </div>
  );
}
