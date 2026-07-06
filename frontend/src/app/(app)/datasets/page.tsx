'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Download, BarChart3, RefreshCw, CheckCircle2,
  AlertCircle, Clock, Layers, FileText, Eye, Zap,
  HardDrive, Activity, ChevronRight, Play, X, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────
interface DatasetInfo {
  name: string;
  purpose: string;
  size_gb: number;
  status: 'ready' | 'partial' | 'missing' | 'unknown' | 'downloading' | 'analyzing';
  meta?: Record<string, any>;
  url?: string;
  benchmark_metrics?: string[];
  use_cases?: string[];
}

interface TaskStatus {
  task_id: string;
  status: string;
  pct?: number;
  message?: string;
}

// ── Dataset config ─────────────────────────────────────────────────────────
const DATASET_CFG: Record<string, {
  icon: string; color: string; badge: string; description: string;
}> = {
  coco:       { icon: '🎯', color: '#22c55e',  badge: 'Object Detection',    description: '80 categories · 330K images · 2.5M instances' },
  mot17:      { icon: '🚶', color: '#00b4d8',  badge: 'Multi-Object Tracking', description: '14 sequences · pedestrian tracking · MOTA/IDF1' },
  market1501: { icon: '👤', color: '#f59e0b',  badge: 'Person Re-ID',         description: '1,501 identities · 6 cameras · 32K images' },
  scannet:    { icon: '🏗',  color: '#a78bfa',  badge: '3D Reconstruction',    description: '707 scenes · RGB-D · meshes · point clouds' },
};

const STATUS_CFG: Record<string, { label: string; color: string; dot: string }> = {
  ready:       { label: 'Ready',       color: 'text-success', dot: 'bg-success' },
  partial:     { label: 'Partial',     color: 'text-warning', dot: 'bg-warning' },
  missing:     { label: 'Not Downloaded', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  unknown:     { label: 'Unknown',     color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  downloading: { label: 'Downloading', color: 'text-accent',   dot: 'bg-accent animate-pulse' },
  analyzing:   { label: 'Analyzing',   color: 'text-purple-400', dot: 'bg-purple-400 animate-pulse' },
};

// ── Dataset Card ───────────────────────────────────────────────────────────
function DatasetCard({
  id, info, taskPct, onDownload, onEDA, onView, isSelected, onClick,
}: {
  id: string; info: DatasetInfo; taskPct?: number;
  onDownload: () => void; onEDA: () => void; onView: () => void;
  isSelected: boolean; onClick: () => void;
}) {
  const cfg = DATASET_CFG[id] ?? { icon: '📦', color: '#00b4d8', badge: id, description: '' };
  const statusCfg = STATUS_CFG[info.status] ?? STATUS_CFG.unknown;
  const isActive = info.status === 'downloading' || info.status === 'analyzing';

  return (
    <motion.div
      layout
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={cn(
        'relative rounded-2xl overflow-hidden cursor-pointer transition-all border',
        isSelected ? 'border-accent/50' : 'border-border hover:border-accent/25',
      )}
      style={{ background: isSelected ? `${cfg.color}08` : 'var(--bg-surface)' }}
    >
      {/* Top accent line */}
      <div className="h-0.5 w-full" style={{ background: cfg.color }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
              style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}30` }}>
              {cfg.icon}
            </div>
            <div>
              <h3 className="text-sm font-bold capitalize">{id}</h3>
              <span className="text-2xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}25` }}>
                {cfg.badge}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={cn('w-2 h-2 rounded-full shrink-0', statusCfg.dot)} />
            <span className={cn('text-2xs font-semibold', statusCfg.color)}>{statusCfg.label}</span>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground mb-3">{cfg.description}</p>

        {/* Stats row */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-1 text-2xs text-muted-foreground">
            <HardDrive className="w-3 h-3" />
            <span>~{info.size_gb} GB</span>
          </div>
          {info.meta?.num_samples && (
            <div className="flex items-center gap-1 text-2xs text-muted-foreground">
              <Database className="w-3 h-3" />
              <span>{info.meta.num_samples.toLocaleString()} samples</span>
            </div>
          )}
          {info.benchmark_metrics && (
            <div className="flex items-center gap-1 text-2xs text-muted-foreground">
              <BarChart3 className="w-3 h-3" />
              <span>{info.benchmark_metrics.slice(0, 2).join(' · ')}</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {isActive && taskPct !== undefined && (
          <div className="mb-3">
            <div className="flex justify-between text-2xs mb-1">
              <span className="text-muted-foreground">{statusCfg.label}…</span>
              <span className="font-mono" style={{ color: cfg.color }}>{taskPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: cfg.color }}
                animate={{ width: `${taskPct}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {info.status === 'missing' || info.status === 'unknown' ? (
            <button onClick={e => { e.stopPropagation(); onDownload(); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02]"
              style={{ background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}aa)`, color: 'white' }}>
              <Download className="w-3.5 h-3.5" /> Download
            </button>
          ) : (
            <button onClick={e => { e.stopPropagation(); onEDA(); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02]"
              style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
              <BarChart3 className="w-3.5 h-3.5" /> Run EDA
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); onView(); }}
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-accent/30 transition-colors">
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Detail Panel ───────────────────────────────────────────────────────────
function DatasetDetailPanel({
  id, info, onClose
}: { id: string; info: DatasetInfo; onClose: () => void }) {
  const cfg = DATASET_CFG[id] ?? { icon: '📦', color: '#00b4d8', badge: id, description: '' };

  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
      exit={{ x: 20, opacity: 0 }}
      className="h-full flex flex-col overflow-y-auto"
    >
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{cfg.icon}</span>
          <div>
            <h2 className="text-sm font-bold capitalize">{id}</h2>
            <p className="text-2xs text-muted-foreground">{cfg.badge}</p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Benchmark metrics */}
        {info.benchmark_metrics && (
          <div>
            <h4 className="text-2xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">Benchmark Metrics</h4>
            <div className="flex flex-wrap gap-1.5">
              {info.benchmark_metrics.map(m => (
                <span key={m} className="text-2xs px-2 py-1 rounded-lg font-mono font-semibold"
                  style={{ background: `${cfg.color}12`, color: cfg.color, border: `1px solid ${cfg.color}25` }}>
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Use cases */}
        {info.use_cases && (
          <div>
            <h4 className="text-2xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">Use Cases</h4>
            <div className="space-y-1.5">
              {info.use_cases.map(u => (
                <div key={u} className="flex items-center gap-2 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.color }} />
                  {u}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Meta stats */}
        {info.meta && Object.keys(info.meta).length > 0 && (
          <div>
            <h4 className="text-2xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">Metadata</h4>
            <div className="space-y-1.5">
              {Object.entries(info.meta).slice(0, 8).map(([k, v]) => (
                <div key={k} className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</span>
                  <span className="font-mono font-semibold">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Official source link */}
        {info.url && (
          <a href={info.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-accent hover:underline">
            <ExternalLink className="w-3.5 h-3.5" />
            Official Dataset Source
          </a>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Record<string, DatasetInfo>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Record<string, TaskStatus>>({});
  const [taskPcts, setTaskPcts] = useState<Record<string, number>>({});

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/datasets/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDatasets(data.datasets || {});
    } catch {
      // Backend not running — show placeholder UI
      setDatasets({
        coco:       { name: 'COCO 2017',      purpose: 'Object Detection',       size_gb: 1.2, status: 'missing', benchmark_metrics: ['AP', 'AP50', 'AP75'], use_cases: ['Object detection', 'Weapon detection'] },
        mot17:      { name: 'MOT17',           purpose: 'Multi-Object Tracking',  size_gb: 5.7, status: 'missing', benchmark_metrics: ['MOTA', 'IDF1', 'MOTP'], use_cases: ['Pedestrian tracking', 'CCTV analysis'] },
        market1501: { name: 'Market-1501',     purpose: 'Person Re-ID',           size_gb: 0.6, status: 'missing', benchmark_metrics: ['Rank-1', 'mAP', 'CMC'], use_cases: ['Cross-camera tracking', 'Suspect re-ID'] },
        scannet:    { name: 'ScanNet v2',      purpose: '3D Scene Reconstruction', size_gb: 2.5, status: 'missing', benchmark_metrics: ['mIoU', 'Scene Completion'], use_cases: ['3D reconstruction', 'Camera calibration'] },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Poll task progress
  useEffect(() => {
    const active = Object.entries(tasks).filter(([, t]) =>
      t.status === 'PROGRESS' || t.status === 'PENDING' || t.status === 'STARTED'
    );
    if (active.length === 0) return;
    const iv = setInterval(async () => {
      for (const [dsName, task] of active) {
        try {
          const res = await fetch(`${API}/api/v1/datasets/task/${task.task_id}`);
          const data: TaskStatus = await res.json();
          setTasks(prev => ({ ...prev, [dsName]: data }));
          if (data.pct !== undefined) {
            setTaskPcts(prev => ({ ...prev, [dsName]: data.pct! }));
          }
          if (data.status === 'SUCCESS' || data.status === 'FAILURE') {
            setDatasets(prev => ({
              ...prev,
              [dsName]: { ...prev[dsName], status: data.status === 'SUCCESS' ? 'ready' : 'missing' },
            }));
            toast[data.status === 'SUCCESS' ? 'success' : 'error'](
              `${dsName}: ${data.status === 'SUCCESS' ? 'Ready' : 'Failed'}`
            );
          }
        } catch { /* ignore */ }
      }
    }, 2500);
    return () => clearInterval(iv);
  }, [tasks]);

  const handleDownload = async (name: string) => {
    setDatasets(prev => ({ ...prev, [name]: { ...prev[name], status: 'downloading' } }));
    setTaskPcts(prev => ({ ...prev, [name]: 0 }));
    try {
      const res = await fetch(`${API}/api/v1/datasets/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset: name }),
      });
      const data = await res.json();
      setTasks(prev => ({ ...prev, [name]: { task_id: data.task_id, status: 'PROGRESS' } }));
      toast.info(`Downloading ${name}…`);
    } catch {
      toast.error(`Failed to start download for ${name}`);
      setDatasets(prev => ({ ...prev, [name]: { ...prev[name], status: 'missing' } }));
    }
  };

  const handleEDA = async (name: string) => {
    setDatasets(prev => ({ ...prev, [name]: { ...prev[name], status: 'analyzing' } }));
    setTaskPcts(prev => ({ ...prev, [name]: 0 }));
    try {
      const res = await fetch(`${API}/api/v1/datasets/eda`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset: name }),
      });
      const data = await res.json();
      setTasks(prev => ({ ...prev, [name]: { task_id: data.task_id, status: 'PROGRESS' } }));
      toast.info(`Running EDA for ${name}…`);
    } catch {
      toast.error(`Failed to start EDA for ${name}`);
    }
  };

  const handleRunAll = async (action: 'download' | 'eda') => {
    for (const name of Object.keys(datasets)) {
      if (action === 'download') await handleDownload(name);
      else await handleEDA(name);
      await new Promise(r => setTimeout(r, 300));
    }
  };

  const totalSize = Object.values(datasets).reduce((s, d) => s + (d.size_gb || 0), 0);
  const readyCount = Object.values(datasets).filter(d => d.status === 'ready').length;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border shrink-0">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-4 rounded-full bg-accent" />
              <span className="text-2xs font-bold text-accent tracking-widest uppercase">Dataset Analytics</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Data Engineering Pipeline</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {readyCount}/{Object.keys(datasets).length} datasets ready · ~{totalSize.toFixed(1)} GB total
            </p>
          </motion.div>

          <div className="flex items-center gap-2">
            <button onClick={fetchStatus}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border border-border text-muted-foreground hover:text-foreground hover:border-accent/30 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button onClick={() => handleRunAll('download')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border border-border text-muted-foreground hover:text-foreground hover:border-accent/30 transition-colors">
              <Download className="w-3.5 h-3.5" /> Download All
            </button>
            <button onClick={() => handleRunAll('eda')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:scale-[1.02] transition-all"
              style={{ background: 'linear-gradient(135deg,#00b4d8,#1565c0)', color: 'white', boxShadow: '0 4px 16px rgba(0,180,216,0.3)' }}>
              <BarChart3 className="w-4 h-4" /> Run All EDA
            </button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-px bg-border shrink-0">
          {[
            { label: 'Datasets', value: Object.keys(datasets).length, icon: Database, color: '#00b4d8' },
            { label: 'Ready',    value: readyCount, icon: CheckCircle2, color: '#22c55e' },
            { label: 'Total Size', value: `${totalSize.toFixed(1)} GB`, icon: HardDrive, color: '#f59e0b' },
            { label: 'Benchmarks', value: '9 metrics', icon: BarChart3, color: '#a78bfa' },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex items-center gap-3 px-5 py-3.5 bg-[var(--bg-surface)]">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${stat.color}15`, border: `1px solid ${stat.color}25` }}>
                  <Icon className="w-4 h-4" style={{ color: stat.color }} />
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums">{stat.value}</p>
                  <p className="text-2xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dataset cards */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-48 rounded-2xl skeleton" />
              ))}
            </div>
          ) : (
            <motion.div
              initial="hidden" animate="visible"
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {Object.entries(datasets).map(([id, info]) => (
                <motion.div key={id} variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
                  <DatasetCard
                    id={id}
                    info={info}
                    taskPct={taskPcts[id]}
                    onDownload={() => handleDownload(id)}
                    onEDA={() => handleEDA(id)}
                    onView={() => window.open(`${API}/api/v1/datasets/reports/${id}/html`, '_blank')}
                    isSelected={selected === id}
                    onClick={() => setSelected(prev => prev === id ? null : id)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Pipeline info */}
          <div className="mt-8 rounded-2xl border border-border overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border bg-white/[0.01]">
              <Zap className="w-4 h-4 text-accent" />
              <span className="text-sm font-bold">Pipeline Architecture</span>
            </div>
            <div className="p-5 grid grid-cols-3 md:grid-cols-5 gap-3">
              {[
                { step: '1', label: 'Download', desc: 'Auto-download with resume + checksum', color: '#00b4d8' },
                { step: '2', label: 'Verify', desc: 'Integrity checks + metadata parsing', color: '#22c55e' },
                { step: '3', label: 'EDA', desc: 'Automated charts, stats, HTML reports', color: '#f59e0b' },
                { step: '4', label: 'Preprocess', desc: 'YOLO/ByteTrack/FastReID conversion', color: '#a78bfa' },
                { step: '5', label: 'Cache', desc: 'Index + metadata for fast future access', color: '#fb923c' },
              ].map(item => (
                <div key={item.step} className="text-center p-3 rounded-xl border border-border"
                  style={{ background: `${item.color}06` }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold"
                    style={{ background: `${item.color}15`, color: item.color, border: `1px solid ${item.color}30` }}>
                    {item.step}
                  </div>
                  <p className="text-xs font-bold mb-1" style={{ color: item.color }}>{item.label}</p>
                  <p className="text-2xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selected && datasets[selected] && (
          <motion.div
            initial={{ width: 0, opacity: 0 }} animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.25 }}
            className="shrink-0 border-l border-border bg-[#08091a] overflow-hidden"
          >
            <DatasetDetailPanel
              id={selected}
              info={datasets[selected]}
              onClose={() => setSelected(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
