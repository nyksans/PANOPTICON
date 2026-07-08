'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, Users, Camera, Target, MapPin, Clock, Zap, Activity,
  ChevronRight, Search, RefreshCw, AlertTriangle, CheckCircle,
  Link2, Siren, GitMerge, BarChart3, Crosshair, Wifi,
} from 'lucide-react';
import { mockSuspects, mockCases } from '@/lib/mockData';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn, formatRelativeTime } from '@/lib/utils';
import { SUSPECT_TRAJECTORIES, LIVE_STATS_BASELINE, jitterStats } from '@/lib/forensicData';
import { toast } from 'sonner';

// ── Live event types ──────────────────────────────────────────────────────────
type EventType = 'reid_match' | 'new_detection' | 'cross_cam' | 'weapon_alert' | 'bolo_hit';

interface LiveEvent {
  id: string; time: string; type: EventType;
  suspect: string; camera: string; confidence: number; caseNumber: string;
}

const BASE_EVENTS: LiveEvent[] = [
  { id: 'ev-1', time: '14:32:28', type: 'reid_match',    suspect: 'Suspect Alpha', camera: 'CAM-STN-004', confidence: 94, caseNumber: 'PAN-2026-0047' },
  { id: 'ev-2', time: '14:31:48', type: 'new_detection', suspect: 'Suspect Beta',  camera: 'CAM-STN-004', confidence: 88, caseNumber: 'PAN-2026-0047' },
  { id: 'ev-3', time: '09:14:22', type: 'reid_match',    suspect: 'Person of Interest 1', camera: 'CAM-PARK-N01', confidence: 71, caseNumber: 'PAN-2026-0043' },
  { id: 'ev-4', time: '03:15:44', type: 'weapon_alert',  suspect: 'Suspect Gamma', camera: 'CAM-PORT-B02', confidence: 83, caseNumber: 'PAN-2026-0039' },
  { id: 'ev-5', time: '03:02:11', type: 'cross_cam',     suspect: 'Suspect Delta', camera: 'CAM-PORT-B01 → CAM-PORT-B02', confidence: 91, caseNumber: 'PAN-2026-0039' },
  { id: 'ev-6', time: '02:47:33', type: 'bolo_hit',      suspect: 'Unknown Male',  camera: 'CAM-DT-001',  confidence: 79, caseNumber: 'PAN-2026-0051' },
];

const SYNTHETIC_EVENTS: Omit<LiveEvent, 'id' | 'time'>[] = [
  { type: 'reid_match',    suspect: 'Suspect Alpha', camera: 'CAM-STN-002', confidence: 89, caseNumber: 'PAN-2026-0047' },
  { type: 'cross_cam',     suspect: 'Suspect Beta',  camera: 'CAM-STN-004 → CAM-STN-005', confidence: 82, caseNumber: 'PAN-2026-0047' },
  { type: 'new_detection', suspect: 'Unknown Person', camera: 'CAM-DT-001', confidence: 67, caseNumber: 'PAN-2026-0051' },
  { type: 'weapon_alert',  suspect: 'Suspect Gamma', camera: 'CAM-PORT-B01', confidence: 91, caseNumber: 'PAN-2026-0039' },
  { type: 'bolo_hit',      suspect: 'Person of Interest 2', camera: 'CAM-PARK-N01', confidence: 74, caseNumber: 'PAN-2026-0043' },
];

const cameraGrid = [
  { id: 'CAM-STN-004', name: 'Central Station P4', status: 'active', suspects: 2, thumbnail: 'https://picsum.photos/seed/cam1/320/180' },
  { id: 'CAM-STN-002', name: 'Station Concourse',  status: 'active', suspects: 0, thumbnail: 'https://picsum.photos/seed/cam2/320/180' },
  { id: 'CAM-PARK-N01', name: 'Riverside Park N',  status: 'active', suspects: 1, thumbnail: 'https://picsum.photos/seed/cam3/320/180' },
  { id: 'CAM-PORT-B01', name: 'Port Zone B-1',     status: 'active', suspects: 3, thumbnail: 'https://picsum.photos/seed/cam4/320/180' },
  { id: 'CAM-PORT-B02', name: 'Port Zone B-2',     status: 'active', suspects: 4, thumbnail: 'https://picsum.photos/seed/cam5/320/180' },
  { id: 'CAM-DT-001',   name: 'Downtown Core',     status: 'idle',   suspects: 0, thumbnail: 'https://picsum.photos/seed/cam6/320/180' },
];

// ── Event color/label config ──────────────────────────────────────────────────
const EVENT_CFG: Record<EventType, { color: string; label: string; dot: string }> = {
  reid_match:    { color: 'text-success/80',  label: 'ReID Match',    dot: 'bg-success'  },
  new_detection: { color: 'text-warning/80',  label: 'Detection',     dot: 'bg-warning'  },
  cross_cam:     { color: 'text-accent/80',   label: 'Cross-Camera',  dot: 'bg-accent'   },
  weapon_alert:  { color: 'text-danger/80',   label: 'WEAPON ALERT',  dot: 'bg-danger'   },
  bolo_hit:      { color: 'text-primary/80',  label: 'BOLO Hit',      dot: 'bg-primary'  },
};

export default function TrackingPage() {
  const [selectedSuspect, setSelectedSuspect] = useState(mockSuspects[0]);
  const [feed, setFeed] = useState<LiveEvent[]>(BASE_EVENTS);
  const [ticker, setTicker] = useState(0);
  const [liveStats, setLiveStats] = useState(LIVE_STATS_BASELINE);
  const [search, setSearch] = useState('');
  const [weaponAlert, setWeaponAlert] = useState(false);
  const [selectedView, setSelectedView] = useState<'cameras' | 'trajectory'>('cameras');
  const feedRef = useRef<HTMLDivElement>(null);
  const tickRef = useRef(0);

  // Live event simulation + stats jitter
  useEffect(() => {
    const iv = setInterval(() => {
      tickRef.current += 1;
      setTicker(t => t + 1);
      setLiveStats(s => jitterStats(s, tickRef.current));

      // Inject synthetic event every ~8s
      if (tickRef.current % 2 === 0) {
        const template = SYNTHETIC_EVENTS[tickRef.current % SYNTHETIC_EVENTS.length];
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
        const newEvent: LiveEvent = {
          ...template,
          id: `ev-live-${tickRef.current}`,
          time: timeStr,
        };
        setFeed(f => [newEvent, ...f].slice(0, 20));

        if (template.type === 'weapon_alert') {
          setWeaponAlert(true);
          setTimeout(() => setWeaponAlert(false), 5000);
          toast.error(`WEAPON ALERT — ${template.camera}`, { duration: 5000 });
        }
      }
    }, 4000);
    return () => clearInterval(iv);
  }, []);

  const allSuspects = mockCases.flatMap((c) =>
    mockSuspects.filter((s) => s.caseId === c.id).map((s) => ({ ...s, caseNumber: c.caseNumber }))
  ).filter(s => !search || s.label.toLowerCase().includes(search.toLowerCase()));

  // Live stats bar values
  const STATS = [
    { label: 'Active Cameras', value: String(liveStats.activeCameras), icon: Camera, color: '#00b4d8' },
    { label: 'Suspects Tracked', value: String(liveStats.suspectsActive), icon: Target, color: '#f59e0b' },
    { label: 'Live Detections', value: String(ticker % 7 + 2), icon: Activity, color: '#22c55e' },
    { label: 'ReID/min', value: String(liveStats.reidMatches), icon: GitMerge, color: '#a78bfa' },
    { label: 'Processing FPS', value: String(liveStats.processingFps), icon: Zap, color: '#00b4d8' },
    { label: 'AI Accuracy', value: `${liveStats.detectionAccuracy}%`, icon: BarChart3, color: '#22c55e' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Weapon alert banner ── */}
      <AnimatePresence>
        {weaponAlert && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center gap-3 px-5 py-2.5 shrink-0 overflow-hidden"
            style={{ background: 'rgba(239,68,68,0.12)', borderBottom: '1px solid rgba(239,68,68,0.3)' }}>
            <Siren className="w-4 h-4 text-danger animate-pulse shrink-0" />
            <span className="text-sm font-bold text-danger">WEAPON DETECTED — Immediate response required</span>
            <span className="text-2xs text-danger/70 font-mono ml-auto">Market-1501 ReID: active</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: suspects list */}
        <div className="w-72 shrink-0 border-r border-border flex flex-col bg-[#070c19]">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold">Active Tracking</h2>
              <div className="ml-auto flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-2xs text-success/80">Live</span>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                type="text" placeholder="Search suspects..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent/40"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-border/50">
            {allSuspects.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSuspect(s)}
                className={cn(
                  'w-full flex items-start gap-3 p-4 text-left transition-colors',
                  selectedSuspect?.id === s.id
                    ? 'bg-accent/8 border-l-2 border-l-accent'
                    : 'hover:bg-surface-raised/50 border-l-2 border-l-transparent'
                )}
              >
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-surface-raised">
                    <img src={s.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className={cn(
                    'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#070c19]',
                    s.status === 'unidentified' ? 'bg-warning' : s.status === 'identified' ? 'bg-success' : 'bg-muted-foreground'
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold truncate">{s.label}</span>
                    <ConfidenceBadge score={s.confidenceScore} size="sm" showLabel={false} />
                  </div>
                  <p className="text-2xs font-mono text-muted-foreground/60 mt-0.5">{'caseNumber' in s ? (s as any).caseNumber : ''}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-2xs text-muted-foreground flex items-center gap-1">
                      <Camera className="w-2.5 h-2.5" />{s.cameras?.length || 0} cams
                    </span>
                    <span className="text-2xs text-muted-foreground">{s.appearances} sightings</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Dataset badge */}
          <div className="p-3 border-t border-border space-y-1.5">
            <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <Crosshair className="w-3 h-3 text-warning shrink-0" />
              <span className="text-2xs text-warning font-semibold">Market-1501 ReID Active</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg"
              style={{ background: 'rgba(0,180,216,0.06)', border: '1px solid rgba(0,180,216,0.18)' }}>
              <BarChart3 className="w-3 h-3 text-accent shrink-0" />
              <span className="text-2xs text-accent font-semibold">MOT17 Tracker Validated</span>
            </div>
          </div>
        </div>

      {/* Center: main tracking view */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Live stats bar */}
        <div className="flex items-center gap-4 px-5 py-2.5 border-b border-border bg-[#080d1a] shrink-0 overflow-x-auto">
          {STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex items-center gap-2 shrink-0">
                <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                </div>
                <div>
                  <p className="text-sm font-bold tabular-nums leading-none" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-2xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            );
          })}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {/* View toggle */}
            <div className="flex rounded-lg overflow-hidden border border-border">
              {(['cameras', 'trajectory'] as const).map(v => (
                <button key={v} onClick={() => setSelectedView(v)}
                  className={cn('px-3 py-1.5 text-2xs font-semibold capitalize transition-colors',
                    selectedView === v ? 'bg-accent/15 text-accent' : 'text-muted-foreground hover:text-foreground')}>
                  {v === 'cameras' ? '📹 Cameras' : '📍 Trajectory'}
                </button>
              ))}
            </div>
            <button onClick={() => toast.success('Feed refreshed')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border hover:border-accent/30 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>

        {/* BOLO header */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedSuspect && (
            <motion.div key={selectedSuspect.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 p-4 rounded-xl bg-warning/5 border border-warning/20 mb-4">
              <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                <img src={selectedSuspect.thumbnailUrl} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-warning" />
                  <span className="text-sm font-semibold text-warning">Tracking: {selectedSuspect.label}</span>
                  <ConfidenceBadge score={selectedSuspect.confidenceScore} size="sm" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Last seen: {formatRelativeTime(selectedSuspect.lastSeen)} · {selectedSuspect.cameras.join(', ')}
                </p>
                {/* trajectory path from dataset */}
                {SUSPECT_TRAJECTORIES[0] && (
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {SUSPECT_TRAJECTORIES[0].path.map((pt, i) => (
                      <React.Fragment key={i}>
                        <span className="text-2xs font-mono px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
                          {pt.cameraId}
                        </span>
                        {i < SUSPECT_TRAJECTORIES[0].path.length - 1 && (
                          <span className="text-2xs text-muted-foreground/40">→</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warning/10 border border-warning/30">
                <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                <span className="text-xs text-warning/80 font-medium">BOLO Active</span>
              </div>
            </motion.div>
          )}

          {/* Camera grid */}
          {selectedView === 'cameras' && (
            <div className="grid grid-cols-3 gap-3">
              {cameraGrid.map((cam, i) => (
                <motion.div key={cam.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn('relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer hover:border-accent/40',
                    cam.suspects > 0 ? 'border-warning/40' : 'border-border')}>
                  <div className="relative aspect-video bg-black">
                    <img src={cam.thumbnail} alt={cam.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0"
                      style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 4px)' }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    {/* Camera ID */}
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      <div className={cn('w-1.5 h-1.5 rounded-full', cam.status === 'active' ? 'bg-success animate-pulse' : 'bg-muted-foreground')} />
                      <span className="text-2xs font-mono text-white/80 bg-black/50 px-1.5 py-0.5 rounded">{cam.id}</span>
                    </div>
                    {/* Suspects badge */}
                    {cam.suspects > 0 && (
                      <div className="absolute top-2 right-2">
                        <span className="flex items-center gap-1 text-2xs bg-warning/80 text-black px-1.5 py-0.5 rounded font-bold">
                          <Target className="w-2.5 h-2.5" />{cam.suspects}
                        </span>
                      </div>
                    )}
                    {/* Detection box overlay */}
                    {cam.suspects > 0 && cam.id === 'CAM-STN-004' && (
                      <div className="absolute border-2 border-warning/80 rounded"
                        style={{ left: '35%', top: '20%', width: '15%', height: '55%' }} />
                    )}
                    {cam.suspects > 0 && cam.id === 'CAM-PORT-B02' && (
                      <>
                        <div className="absolute border-2 border-warning/70 rounded"
                          style={{ left: '20%', top: '15%', width: '14%', height: '50%' }} />
                        <div className="absolute border-2 border-accent/60 rounded"
                          style={{ left: '55%', top: '25%', width: '12%', height: '45%' }} />
                      </>
                    )}
                  </div>
                  <div className="p-2 bg-[#080d1a] flex items-center justify-between">
                    <span className="text-xs font-medium truncate">{cam.name}</span>
                    <span className={cn('text-2xs', cam.status === 'active' ? 'text-success/70' : 'text-muted-foreground')}>
                      {cam.status}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Trajectory view */}
          {selectedView === 'trajectory' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-border"
                style={{ background: 'rgba(0,180,216,0.04)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <GitMerge className="w-4 h-4 text-accent" />
                  <span className="text-sm font-bold">Cross-Camera Movement Analysis</span>
                  <span className="text-2xs ml-auto text-muted-foreground">Market-1501 validated</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Suspect trajectories reconstructed from {SUSPECT_TRAJECTORIES.flatMap(t => t.path).length} camera appearances
                  across {new Set(SUSPECT_TRAJECTORIES.flatMap(t => t.path.map(p => p.cameraId))).size} unique camera nodes.
                </p>
              </div>
              {SUSPECT_TRAJECTORIES.map(traj => (
                <div key={traj.suspectId} className="rounded-xl overflow-hidden border border-border">
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border"
                    style={{ background: `${traj.color}08` }}>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: traj.color, boxShadow: `0 0 6px ${traj.color}` }} />
                    <span className="text-sm font-bold" style={{ color: traj.color }}>{traj.label}</span>
                    <span className="ml-auto text-2xs text-muted-foreground">{traj.path.length} waypoints</span>
                  </div>
                  <div className="relative pl-4">
                    <div className="absolute left-8 top-0 bottom-0 w-px"
                      style={{ background: `linear-gradient(to bottom, ${traj.color}50, transparent)` }} />
                    {traj.path.map((pt, i) => (
                      <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] border-b border-border/40 last:border-0">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 mt-0.5"
                          style={{ background: `${traj.color}20`, border: `2px solid ${traj.color}60` }}>
                          <span className="text-2xs font-bold" style={{ color: traj.color }}>{i + 1}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold" style={{ color: traj.color }}>{pt.time}</span>
                            <Camera className="w-3 h-3 text-muted-foreground/40" />
                            <span className="text-2xs font-mono text-muted-foreground/60">{pt.cameraId}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{pt.location}</p>
                        </div>
                        <ConfidenceBadge score={pt.confidence} size="sm" showLabel={false} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: live event feed */}
      <div className="w-72 shrink-0 border-l border-border flex flex-col bg-[#070c19]">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold">Live Events</span>
            <span className="ml-1 text-2xs font-mono bg-accent/10 text-accent border border-accent/20 px-1.5 py-0.5 rounded">
              {feed.length}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-2xs text-accent/70">Streaming</span>
            </div>
          </div>
        </div>

        <div ref={feedRef} className="flex-1 overflow-y-auto no-scrollbar divide-y divide-border/50">
          <AnimatePresence initial={false}>
            {feed.map((event) => {
              const cfg = EVENT_CFG[event.type];
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: 16, backgroundColor: 'rgba(0,180,216,0.08)' }}
                  animate={{ opacity: 1, x: 0, backgroundColor: 'transparent' }}
                  transition={{ duration: 0.3 }}
                  className="p-3 hover:bg-surface-raised/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot,
                      event.type === 'weapon_alert' ? 'animate-pulse' : '')} />
                    <span className={cn('text-2xs font-semibold', cfg.color)}>
                      {cfg.label}
                    </span>
                    <span className="ml-auto text-2xs font-mono text-muted-foreground/50">{event.time}</span>
                  </div>
                  <p className="text-xs font-semibold">{event.suspect}</p>
                  <p className="text-2xs text-muted-foreground mt-0.5 truncate">{event.camera}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-2xs font-mono text-muted-foreground/50">{event.caseNumber}</span>
                    <ConfidenceBadge score={event.confidence} size="sm" showLabel={false} />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Stats footer */}
        <div className="p-3 border-t border-border space-y-1.5">
          {[
            { label: 'Tracking FPS', value: `${liveStats.processingFps}`, color: '#00b4d8' },
            { label: 'ReID accuracy', value: `${liveStats.detectionAccuracy}%`, color: '#22c55e' },
            { label: 'Network', value: `${liveStats.networkLatency}ms`, color: '#a78bfa' },
          ].map(s => (
            <div key={s.label} className="flex justify-between items-center px-2 py-1.5 rounded-lg border border-border">
              <span className="text-2xs text-muted-foreground">{s.label}</span>
              <span className="text-2xs font-mono font-bold" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      </div>{/* end flex-1 row */}
    </div>
  );
}
