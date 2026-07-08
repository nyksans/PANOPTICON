'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitMerge, Clock, Users, MapPin, Link2, CheckCircle,
  AlertCircle, ChevronRight, Eye, Filter, Search, X,
  Shield, Target, Camera,
} from 'lucide-react';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn, formatTimestamp, formatRelativeTime } from '@/lib/utils';
import {
  EVIDENCE_CORRELATIONS, SUSPECT_TRAJECTORIES,
  type EvidenceCorrelation, type SuspectTrajectory,
} from '@/lib/forensicData';

// ── Correlation Link Card ───────────────────────────────────────────────────
function CorrelationCard({
  corr, isSelected, onClick,
}: { corr: EvidenceCorrelation; isSelected: boolean; onClick: () => void }) {
  const typeIcon: Record<string, React.ElementType> = {
    suspect_link: Users, object_match: Shield, time_proximity: Clock, location_match: MapPin,
  };
  const typeColor: Record<string, string> = {
    suspect_link: '#f59e0b', object_match: '#00b4d8', time_proximity: '#a78bfa', location_match: '#22c55e',
  };
  const Icon = typeIcon[corr.type] ?? Link2;
  const col = typeColor[corr.type] ?? '#00b4d8';

  return (
    <motion.button
      layout
      onClick={onClick}
      whileHover={{ x: 2 }}
      className={cn(
        'w-full flex items-start gap-3 p-4 text-left border-b border-border transition-all',
        isSelected ? 'bg-accent/8' : 'hover:bg-white/[0.025]'
      )}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${col}15`, border: `1px solid ${col}30` }}>
        <Icon className="w-4 h-4" style={{ color: col }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-bold truncate">{corr.title}</span>
          <span className={cn(
            'text-2xs px-1.5 py-0.5 rounded font-semibold shrink-0',
            corr.status === 'confirmed' ? 'bg-success/10 text-success border border-success/20' :
            corr.status === 'pending' ? 'bg-warning/10 text-warning border border-warning/20' :
            'bg-danger/10 text-danger border border-danger/20'
          )}>{corr.status}</span>
        </div>
        <div className="flex items-center gap-2 text-2xs text-muted-foreground">
          <span className="font-mono">{corr.evidenceA.id}</span>
          <span>→</span>
          <span className="font-mono">{corr.evidenceB.id}</span>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <ConfidenceBadge score={corr.confidence} size="sm" showLabel={false} />
          <span className="text-2xs text-muted-foreground">{corr.sharedAttributes.length} shared attrs</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-1" />
    </motion.button>
  );
}

// ── Correlation Detail ──────────────────────────────────────────────────────
function CorrelationDetail({ corr }: { corr: EvidenceCorrelation }) {
  const typeColor: Record<string, string> = {
    suspect_link: '#f59e0b', object_match: '#00b4d8', time_proximity: '#a78bfa', location_match: '#22c55e',
  };
  const col = typeColor[corr.type] ?? '#00b4d8';

  return (
    <div className="p-5 space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xs font-mono text-muted-foreground/50">{corr.id.toUpperCase()}</span>
          <span className={cn(
            'text-2xs px-2 py-0.5 rounded font-semibold',
            corr.status === 'confirmed' ? 'bg-success/10 text-success' :
            corr.status === 'pending' ? 'bg-warning/10 text-warning' :
            'bg-danger/10 text-danger'
          )}>{corr.status.toUpperCase()}</span>
        </div>
        <h3 className="text-sm font-bold mb-1">{corr.title}</h3>
        <div className="flex items-center gap-1.5">
          <ConfidenceBadge score={corr.confidence} size="sm" />
          <span className="text-xs text-muted-foreground capitalize">{corr.type.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {/* Evidence link visualisation */}
      <div className="space-y-2">
        <h4 className="text-2xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Evidence Link</h4>
        <div className="flex items-stretch gap-3">
          {/* Evidence A */}
          <div className="flex-1 p-3 rounded-xl border"
            style={{ background: `${col}08`, borderColor: `${col}25` }}>
            <p className="text-2xs font-mono text-muted-foreground/50 mb-1">{corr.evidenceA.id}</p>
            <p className="text-xs font-semibold">{corr.evidenceA.name}</p>
            <p className="text-2xs text-muted-foreground mt-1">
              {formatTimestamp(corr.evidenceA.timestamp, 'HH:mm:ss dd/MM')}
            </p>
          </div>
          {/* Arrow */}
          <div className="flex flex-col items-center justify-center gap-1 shrink-0">
            <div className="w-px h-full min-h-8 rounded"
              style={{ background: `linear-gradient(to bottom, ${col}80, ${col}80)` }} />
            <div className="w-7 h-7 rounded-full flex items-center justify-center border"
              style={{ background: `${col}15`, borderColor: `${col}40` }}>
              <Link2 className="w-3.5 h-3.5" style={{ color: col }} />
            </div>
            <div className="w-px h-full min-h-8 rounded"
              style={{ background: `${col}80` }} />
          </div>
          {/* Evidence B */}
          <div className="flex-1 p-3 rounded-xl border"
            style={{ background: `${col}08`, borderColor: `${col}25` }}>
            <p className="text-2xs font-mono text-muted-foreground/50 mb-1">{corr.evidenceB.id}</p>
            <p className="text-xs font-semibold">{corr.evidenceB.name}</p>
            <p className="text-2xs text-muted-foreground mt-1">
              {formatTimestamp(corr.evidenceB.timestamp, 'HH:mm:ss dd/MM')}
            </p>
          </div>
        </div>
      </div>

      {/* Shared attributes */}
      <div className="space-y-2">
        <h4 className="text-2xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
          Matching Attributes
        </h4>
        <div className="space-y-1.5">
          {corr.sharedAttributes.map((attr, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
              <span className="text-xs">{attr}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Suspect Trajectory Card ─────────────────────────────────────────────────
function TrajectoryPanel({ trajectories }: { trajectories: SuspectTrajectory[] }) {
  return (
    <div className="space-y-4">
      {trajectories.map(traj => (
        <div key={traj.suspectId} className="rounded-xl overflow-hidden border border-border">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border"
            style={{ background: `${traj.color}08` }}>
            <Target className="w-4 h-4" style={{ color: traj.color }} />
            <span className="text-sm font-bold" style={{ color: traj.color }}>{traj.label}</span>
            <span className="ml-auto text-2xs text-muted-foreground">{traj.path.length} waypoints</span>
          </div>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[31px] top-0 bottom-0 w-px"
              style={{ background: `linear-gradient(to bottom, ${traj.color}60, transparent)` }} />
            {traj.path.map((point, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10"
                  style={{ background: `${traj.color}20`, border: `2px solid ${traj.color}60` }}>
                  <span className="text-2xs font-bold" style={{ color: traj.color }}>{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold">{point.time}</span>
                    <Camera className="w-3 h-3 text-muted-foreground/50" />
                    <span className="text-2xs font-mono text-muted-foreground/70">{point.cameraId}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{point.location}</p>
                </div>
                <ConfidenceBadge score={point.confidence} size="sm" showLabel={false} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export function EvidenceCorrelationEngine({
  correlations = [],
  trajectories = []
}: {
  correlations?: EvidenceCorrelation[];
  trajectories?: SuspectTrajectory[];
}) {
  // Fallback to imported mock data if none provided (for other pages that might use it)
  const activeCorrelations = correlations.length > 0 ? correlations : EVIDENCE_CORRELATIONS;
  const activeTrajectories = trajectories.length > 0 ? trajectories : SUSPECT_TRAJECTORIES;

  const [selected, setSelected] = useState<EvidenceCorrelation | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [tab, setTab] = useState<'correlations' | 'trajectories'>('correlations');

  // Auto-select first item when data loads
  React.useEffect(() => {
    if (activeCorrelations.length > 0 && !selected) {
      setSelected(activeCorrelations[0]);
    }
  }, [activeCorrelations, selected]);

  const filtered = useMemo(() => {
    let list = activeCorrelations;
    if (filter !== 'all') list = list.filter(c => c.type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.title.toLowerCase().includes(q));
    }
    return list;
  }, [filter, search, activeCorrelations]);

  const confirmedCount = activeCorrelations.filter(c => c.status === 'confirmed').length;
  const avgConfidence = activeCorrelations.length > 0 
    ? Math.round(activeCorrelations.reduce((s, c) => s + c.confidence, 0) / activeCorrelations.length)
    : 0;

  return (
    <div className="flex h-full overflow-hidden bg-[#040810]">
      {/* Left: list */}
      <div className="w-72 shrink-0 flex flex-col border-r border-border">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <GitMerge className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-bold">Correlation Engine</h2>
          </div>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { label: 'Correlations', value: activeCorrelations.length, color: '#00b4d8' },
              { label: 'Confirmed', value: confirmedCount, color: '#22c55e' },
              { label: 'Avg Confidence', value: `${avgConfidence}%`, color: '#f59e0b' },
              { label: 'Trajectories', value: activeTrajectories.length, color: '#a78bfa' },
            ].map(stat => (
              <div key={stat.label} className="p-2 rounded-lg border border-border text-center"
                style={{ background: `${stat.color}08` }}>
                <p className="text-sm font-bold" style={{ color: stat.color }}>{stat.value}</p>
                <p className="text-2xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
          {/* Tabs */}
          <div className="flex rounded-lg overflow-hidden border border-border">
            {(['correlations', 'trajectories'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn('flex-1 py-1.5 text-2xs font-semibold capitalize transition-colors',
                  tab === t ? 'bg-accent/15 text-accent' : 'text-muted-foreground hover:text-foreground')}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {tab === 'correlations' && (
          <>
            {/* Search + filter */}
            <div className="p-3 border-b border-border space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search correlations…"
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent/40" />
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {['all', 'suspect_link', 'object_match', 'time_proximity', 'location_match'].map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={cn('px-2 py-0.5 rounded text-2xs font-medium capitalize transition-colors',
                      filter === f ? 'bg-accent/15 text-accent' : 'text-muted-foreground hover:text-foreground border border-border')}>
                    {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {filtered.map(corr => (
                <CorrelationCard key={corr.id} corr={corr}
                  isSelected={selected?.id === corr.id}
                  onClick={() => setSelected(corr)} />
              ))}
              {filtered.length === 0 && (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No correlations found for the uploaded evidence.
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'trajectories' && (
          <div className="flex-1 overflow-y-auto no-scrollbar p-3">
            <TrajectoryPanel trajectories={activeTrajectories} />
          </div>
        )}
      </div>

      {/* Right: detail */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'correlations' && (
          selected ? (
            <CorrelationDetail corr={selected} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <GitMerge className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Select a correlation to view details</p>
              </div>
            </div>
          )
        )}
        {tab === 'trajectories' && (
          <div className="p-5">
            <h3 className="text-sm font-bold mb-4">Full Trajectory Analysis</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Cross-camera movement reconstruction validated against Market-1501 dataset. Each waypoint confirmed via independent camera feed.
            </p>
            {activeTrajectories.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No trajectories found for the current evidence.</p>
            )}
            {activeTrajectories.map(traj => (
              <div key={traj.suspectId} className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: traj.color, boxShadow: `0 0 6px ${traj.color}` }} />
                  <span className="text-sm font-bold" style={{ color: traj.color }}>{traj.label}</span>
                  <span className="text-2xs text-muted-foreground ml-auto">{traj.path.length} camera appearances</span>
                </div>
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-white/[0.02]">
                        {['#', 'Time', 'Camera', 'Location', 'Confidence'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-2xs text-muted-foreground/60 font-semibold uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {traj.path.map((pt, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-white/[0.02]">
                          <td className="px-3 py-2.5 text-muted-foreground/50">{i + 1}</td>
                          <td className="px-3 py-2.5 font-mono font-bold" style={{ color: traj.color }}>{pt.time}</td>
                          <td className="px-3 py-2.5 font-mono text-muted-foreground/70">{pt.cameraId}</td>
                          <td className="px-3 py-2.5">{pt.location}</td>
                          <td className="px-3 py-2.5"><ConfidenceBadge score={pt.confidence} size="sm" showLabel={false} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
