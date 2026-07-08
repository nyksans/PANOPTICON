'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut,
  Maximize2, Layers, Tag, Bookmark, FileText, Clock,
  Users, Film, BrainCircuit, CheckCircle, Target,
  Box, Network, Video, ChevronDown, AlertTriangle, GitMerge, Upload,
} from 'lucide-react';
import { VideoPlayer, VideoPlayerHandle } from '@/components/investigation/VideoPlayer';
import { mockEvidence, mockTimeline, mockSuspects, mockCases } from '@/lib/mockData';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn, formatTimestamp, formatDuration, formatVideoTimestamp } from '@/lib/utils';
import { toast } from 'sonner';

// Lazy-load heavy components (no SSR)
const SceneViewer3D = dynamic(
  () => import('@/components/investigation/SceneViewer3D').then(m => ({ default: m.SceneViewer3D })),
  { ssr: false, loading: () => <PaneLoader label="Loading 3D Engine…" /> }
);
const RelationshipGraph = dynamic(
  () => import('@/components/investigation/RelationshipGraph').then(m => ({ default: m.RelationshipGraph })),
  { ssr: false, loading: () => <PaneLoader label="Loading Graph…" /> }
);
const EvidenceCorrelationEngine = dynamic(
  () => import('@/components/investigation/EvidenceCorrelationEngine').then(m => ({ default: m.EvidenceCorrelationEngine })),
  { ssr: false, loading: () => <PaneLoader label="Loading Correlation Engine…" /> }
);

function PaneLoader({ label }: { label: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#060b17] rounded-xl border border-border">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground font-mono">{label}</p>
      </div>
    </div>
  );
}

type PanelMode = 'single' | 'split' | 'quad';
type ViewMode  = 'video' | '3d' | 'graph' | 'correlations';
const SPEEDS = [0.25, 0.5, 1, 2, 4];
const TOTAL  = 1800; // 30 min in seconds

export default function InvestigationPage() {
  const [viewMode,        setViewMode]       = useState<ViewMode>('video');
  const [panelMode,       setPanelMode]      = useState<PanelMode>('split');
  const [playing,         setPlaying]        = useState(false);
  const [currentTime,     setCurrentTime]    = useState(870); // 14:44:30 – near robbery
  const [speed,           setSpeed]          = useState(1);
  const [zoom,            setZoom]           = useState(1);
  const [showOverlays,    setShowOverlays]   = useState(true);
  const [selectedCam,     setSelectedCam]    = useState(0);
  const [activeEvent,     setActiveEvent]    = useState<string | null>('tl-003');
  const [bookmarks,       setBookmarks]      = useState<number[]>([]);
  const [note,            setNote]           = useState('');
  const [uploadedVideoSrc,setUploadedVideoSrc]= useState<string | null>(null);
  const tickRef  = useRef<ReturnType<typeof setInterval>>();
  const videoRefs = useRef<(VideoPlayerHandle | null)[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const caseData  = mockCases[4];
  const evidence  = mockEvidence.filter(e => e.caseId === 'case-001' && (e.type === 'video' || e.type === 'bodycam'));
  const timeline  = mockTimeline.filter(t => t.caseId === 'case-001');
  const suspects  = mockSuspects.filter(s => s.caseId === 'case-001');
  const vidCount  = panelMode === 'single' ? 1 : panelMode === 'split' ? 2 : Math.min(4, evidence.length || 1);
  const pct       = (currentTime / TOTAL) * 100;
  const normalised= currentTime / TOTAL;

  // ── Time-keyed detections (animate as scrubber moves) ────────────────
  // Each segment: [startSec, endSec, detections[]]
  const DETECTION_TIMELINE = [
    { from: 0,   to: 200,  items: [
      { label:'Person A', confidence:91, x:0.20, y:0.15, w:0.14, h:0.52, color:'#F59E0B', trackId:'p1' },
    ]},
    { from: 200, to: 400,  items: [
      { label:'Suspect α', confidence:94, x:0.28, y:0.18, w:0.16, h:0.54, color:'#F59E0B', trackId:'p1' },
      { label:'Bag',       confidence:88, x:0.30, y:0.62, w:0.10, h:0.16, color:'#22C55E', trackId:'obj1' },
    ]},
    { from: 400, to: 600,  items: [
      { label:'Suspect α', confidence:94, x:0.32, y:0.20, w:0.16, h:0.54, color:'#F59E0B', trackId:'p1' },
      { label:'Suspect β', confidence:88, x:0.60, y:0.22, w:0.13, h:0.50, color:'#FB923C', trackId:'p2' },
      { label:'Backpack',  confidence:96, x:0.31, y:0.60, w:0.11, h:0.18, color:'#22C55E', trackId:'obj1' },
    ]},
    { from: 600, to: 750,  items: [
      { label:'Suspect α', confidence:97, x:0.35, y:0.18, w:0.17, h:0.56, color:'#F59E0B', trackId:'p1' },
      { label:'Suspect β', confidence:92, x:0.58, y:0.20, w:0.14, h:0.52, color:'#FB923C', trackId:'p2' },
      { label:'Backpack',  confidence:96, x:0.34, y:0.62, w:0.11, h:0.17, color:'#22C55E', trackId:'obj1' },
      { label:'Firearm',   confidence:83, x:0.40, y:0.55, w:0.07, h:0.12, color:'#EF4444', trackId:'obj2' },
    ]},
    { from: 750, to: 900,  items: [
      { label:'Suspect α', confidence:98, x:0.38, y:0.15, w:0.18, h:0.58, color:'#F59E0B', trackId:'p1' },
      { label:'Suspect β', confidence:95, x:0.56, y:0.18, w:0.15, h:0.55, color:'#FB923C', trackId:'p2' },
      { label:'Firearm',   confidence:91, x:0.42, y:0.52, w:0.08, h:0.13, color:'#EF4444', trackId:'obj2' },
      { label:'Phone',     confidence:79, x:0.61, y:0.58, w:0.07, h:0.08, color:'#38BDF8', trackId:'obj3' },
    ]},
    { from: 900, to: 1100, items: [
      { label:'Suspect α', confidence:96, x:0.22, y:0.16, w:0.16, h:0.55, color:'#F59E0B', trackId:'p1' },
      { label:'Suspect β', confidence:89, x:0.65, y:0.22, w:0.14, h:0.50, color:'#FB923C', trackId:'p2' },
      { label:'Vehicle',   confidence:87, x:0.10, y:0.40, w:0.25, h:0.28, color:'#A78BFA', trackId:'obj4' },
    ]},
    { from: 1100, to: 1400, items: [
      { label:'Suspect α', confidence:93, x:0.55, y:0.20, w:0.15, h:0.52, color:'#F59E0B', trackId:'p1' },
      { label:'Bystander', confidence:72, x:0.15, y:0.25, w:0.12, h:0.46, color:'#6B7280', trackId:'p3' },
    ]},
    { from: 1400, to: 1800, items: [
      { label:'Suspect α', confidence:91, x:0.70, y:0.22, w:0.14, h:0.50, color:'#F59E0B', trackId:'p1' },
    ]},
  ];

  const currentDetections = useMemo(() => {
    const seg = DETECTION_TIMELINE.find(s => currentTime >= s.from && currentTime < s.to);
    if (!seg) return [];
    // Add slight position jitter to simulate real tracking noise
    const jitter = 0.003;
    return seg.items.map(d => ({
      ...d,
      x: d.x + (Math.sin(currentTime * 3.7 + d.x * 10) * jitter),
      y: d.y + (Math.cos(currentTime * 2.3 + d.y * 10) * jitter),
    }));
  }, [currentTime]);

  // ── Aggregate stats across all detections for sidebar ────────────────
  const allObjects = useMemo(() => {
    const map = new Map<string, { count: number; maxConf: number; color: string }>();
    DETECTION_TIMELINE.forEach(seg => {
      seg.items.forEach(d => {
        const existing = map.get(d.label);
        if (!existing) {
          map.set(d.label, { count: 1, maxConf: d.confidence, color: d.color });
        } else {
          existing.count++;
          if (d.confidence > existing.maxConf) existing.maxConf = d.confidence;
        }
      });
    });
    return Array.from(map.entries())
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.maxConf - a.maxConf);
  }, []);


  // Play tick
  useEffect(() => {
    if (playing) {
      tickRef.current = setInterval(() => {
        setCurrentTime(t => {
          const next = t + speed * 0.1;
          if (next >= TOTAL) { setPlaying(false); return TOTAL; }
          return next;
        });
      }, 100);
    }
    return () => clearInterval(tickRef.current);
  }, [playing, speed]);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space')       { e.preventDefault(); setPlaying(p => !p); }
      if (e.code === 'KeyJ')        setCurrentTime(t => Math.max(0, t - 10));
      if (e.code === 'KeyL')        setCurrentTime(t => Math.min(TOTAL, t + 10));
      if (e.code === 'KeyK')        setPlaying(false);
      if (e.code === 'ArrowLeft')   setCurrentTime(t => Math.max(0, t - 1/30));
      if (e.code === 'ArrowRight')  setCurrentTime(t => Math.min(TOTAL, t + 1/30));
      if (e.code === 'KeyB')        addBookmark();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const scrub = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setCurrentTime(Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * TOTAL));
  }, []);

  const addBookmark = () => {
    setBookmarks(b => [...new Set([...b, Math.round(currentTime)])].sort((a,b)=>a-b));
    toast.success(`Bookmark at ${formatVideoTimestamp(currentTime)}`, { duration: 2000 });
  };

  const saveNote = () => {
    if (!note.trim()) return;
    toast.success('Note saved to case file', { duration: 2000 });
    setNote('');
  };

  const sigColor: Record<string,string> = {
    critical:'border-danger text-danger', high:'border-warning text-warning',
    medium:'border-accent text-accent',   low:'border-muted-foreground text-muted-foreground',
  };
  const sigBg: Record<string,string> = {
    critical:'bg-danger', high:'bg-warning', medium:'bg-accent', low:'bg-muted-foreground',
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUploadedVideoSrc(url);
      toast.success('Video loaded successfully');
    }
  };

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <input type="file" accept="video/*" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />


      {/* ─── Left sidebar ────────────────────────────────────────── */}
      <div className="w-60 shrink-0 border-r flex flex-col overflow-hidden" style={{ borderColor:'var(--border)', background:'var(--bg-base)' }}>
        {/* Case info */}
        <div className="p-3 border-b border-border">
          <p className="text-2xs font-mono text-muted-foreground/50 mb-0.5">{caseData?.caseNumber}</p>
          <h2 className="text-xs font-semibold leading-snug line-clamp-2">{caseData?.title}</h2>
          <div className="flex items-center gap-2 mt-1.5">
            <StatusBadge status={caseData?.status ?? 'active'} />
            <ConfidenceBadge score={caseData?.confidenceScore ?? 87} size="sm" showLabel={false} />
          </div>
        </div>

        {/* Suspects */}
        <div className="p-3 border-b border-border">
          <p className="text-2xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Users className="w-3 h-3 text-warning/70" /> Suspects
          </p>
          <div className="space-y-1.5">
            {suspects.map(s => (
              <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-surface border border-border hover:border-warning/30 transition-colors cursor-pointer group">
                <div className="relative shrink-0">
                  <img src={s.thumbnailUrl} alt="" className="w-7 h-7 rounded-lg object-cover" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#040810] bg-warning" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate group-hover:text-warning transition-colors">{s.label}</p>
                  <p className="text-2xs text-muted-foreground">{s.cameras?.length || 0} cameras</p>
                </div>
                <ConfidenceBadge score={s.confidenceScore} size="sm" showLabel={false} />
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-3">
          <p className="text-2xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-accent/70" /> Events
          </p>
          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-gradient-to-b from-accent/30 via-accent/15 to-transparent" />
            <div className="space-y-0.5 pl-1">
              {timeline.map(evt => {
                const isActive = evt.id === activeEvent;
                return (
                  <button key={evt.id} onClick={() => setActiveEvent(evt.id)}
                    className={cn('w-full flex items-start gap-2 p-2 rounded-lg text-left transition-all', isActive ? 'bg-accent/10 border border-accent/25' : 'hover:bg-surface-raised/50 border border-transparent')}>
                    <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5', isActive ? 'bg-accent border-accent' : sigColor[evt.significance])}>
                      {evt.verified ? <CheckCircle className="w-2 h-2 text-white" /> : <div className="w-1 h-1 rounded-full bg-current" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-2xs font-mono text-muted-foreground/50">{formatTimestamp(evt.timestamp, 'HH:mm:ss')}</p>
                      <p className="text-xs font-medium line-clamp-1">{evt.title}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bookmarks */}
        {bookmarks.length > 0 && (
          <div className="p-3 border-t border-border">
            <p className="text-2xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Bookmark className="w-3 h-3 text-primary/70" /> Marks
            </p>
            <div className="flex flex-wrap gap-1">
              {bookmarks.map((t,i) => (
                <button key={i} onClick={() => setCurrentTime(t)}
                  className="text-2xs font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 transition-colors">
                  {formatVideoTimestamp(t)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Center viewer ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b shrink-0 flex-wrap" style={{ borderColor:'var(--border)', background:'var(--bg-surface)' }}>
          {/* View tabs */}
          <div className="flex items-center bg-surface border border-border rounded-lg overflow-hidden">
            {([['video', Video, 'Video'], ['3d', Box, '3D Scene'], ['graph', Network, 'Graph'], ['correlations', GitMerge, 'Correlations']] as const).map(([mode, Icon, lbl]) => (
              <button key={mode} onClick={() => setViewMode(mode as ViewMode)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-r border-border last:border-r-0',
                  viewMode === mode ? 'bg-accent/15 text-accent' : 'text-muted-foreground hover:text-foreground')}>
                <Icon className="w-3.5 h-3.5" />{lbl}
              </button>
            ))}
          </div>

          {/* Panel layout (video only) */}
          {viewMode === 'video' && (
            <div className="flex items-center bg-surface border border-border rounded-lg overflow-hidden">
              {(['single','split','quad'] as PanelMode[]).map(m => (
                <button key={m} onClick={() => setPanelMode(m)}
                  className={cn('px-3 py-1.5 text-xs font-medium transition-colors border-r border-border last:border-r-0',
                    panelMode === m ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground')}>
                  {m === 'single' ? '1×' : m === 'split' ? '2×' : '4×'}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {viewMode === 'video' && (
              <button onClick={() => fileInputRef.current?.click()}
                className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors',
                  'border-border text-muted-foreground hover:text-foreground')}>
                <Upload className="w-3.5 h-3.5" /> Load Video
              </button>
            )}
            {viewMode === 'video' && (
              <button onClick={() => setShowOverlays(o => !o)}
                className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors',
                  showOverlays ? 'border-accent/30 text-accent bg-accent/8' : 'border-border text-muted-foreground hover:text-foreground')}>
                <Layers className="w-3.5 h-3.5" /> AI Overlays
              </button>
            )}
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-accent border border-accent/25 bg-accent/5 hover:bg-accent/12 transition-colors">
              <BrainCircuit className="w-3.5 h-3.5" /> AI Mode
            </button>
          </div>
        </div>

        {/* Main content pane */}
        <div className="flex-1 p-3 overflow-hidden">
          {viewMode === '3d' && <SceneViewer3D currentTime={normalised} className="w-full h-full" />}
          {viewMode === 'graph' && (
            <div className="w-full h-full rounded-xl overflow-hidden border border-border">
              <RelationshipGraph />
            </div>
          )}
          {viewMode === 'correlations' && (
            <div className="w-full h-full rounded-xl overflow-hidden border border-border">
              <EvidenceCorrelationEngine />
            </div>
          )}
          {viewMode === 'video' && (
            <div className={cn('w-full h-full gap-2',
              panelMode === 'quad'  ? 'grid grid-cols-2 grid-rows-2' :
              panelMode === 'split' ? 'grid grid-cols-2' :
              'flex')}>
              {(evidence.length > 0
                ? evidence
                : [{ id:'cam-a', type:'video', originalName:'CAM-01 Platform 4', thumbnailUrl:'', metadata:{ cameraId:'CAM-01' }, duration:TOTAL },
                   { id:'cam-b', type:'video', originalName:'CAM-02 Concourse', thumbnailUrl:'', metadata:{ cameraId:'CAM-02' }, duration:TOTAL },
                   { id:'cam-c', type:'video', originalName:'CAM-03 South Entrance', thumbnailUrl:'', metadata:{ cameraId:'CAM-03' }, duration:TOTAL },
                   { id:'cam-d', type:'video', originalName:'CAM-04 Exit Gate', thumbnailUrl:'', metadata:{ cameraId:'CAM-04' }, duration:TOTAL },
                ] as any[])
                .slice(0, vidCount)
                .map((ev: any, idx: number) => (
                <VideoPlayer
                  key={ev.id}
                  ref={(el) => { videoRefs.current[idx] = el; }}
                  src={idx === 0 && uploadedVideoSrc ? uploadedVideoSrc : ev.src}
                  thumbnailUrl={ev.thumbnailUrl}
                  isActive={selectedCam === idx}
                  playing={playing && selectedCam === idx}
                  currentTime={currentTime}
                  zoom={panelMode === 'single' ? zoom : 1}
                  showOverlays={showOverlays}
                  detections={selectedCam === idx && showOverlays ? currentDetections : []}
                  cameraId={ev.metadata?.cameraId ?? ev.id}
                  cameraName={ev.originalName}
                  duration={ev.duration ?? TOTAL}
                  onSelect={() => setSelectedCam(idx)}
                />
              ))}

            </div>
          )}
        </div>

        {/* Playback controls — video only */}
        {viewMode === 'video' && (
          <div className="border-t border-border px-4 pt-3 pb-4 shrink-0" style={{ borderColor:'var(--border)', background:'var(--bg-surface)' }}>
            {/* Scrubber */}
            <div className="mb-3 relative select-none">
              {/* Bookmark pips */}
              {bookmarks.map((bm,i) => (
                <div key={i} className="absolute z-20 -top-1 w-1 h-4 bg-primary/70 rounded-sm"
                  style={{ left:`calc(${(bm/TOTAL)*100}% - 2px)` }} />
              ))}
              {/* Event markers */}
              {timeline.map(evt => {
                const rawPct = ((
                  new Date(evt.timestamp).getHours() * 3600 +
                  new Date(evt.timestamp).getMinutes() * 60 +
                  new Date(evt.timestamp).getSeconds() - 14 * 3600
                ) / TOTAL) * 100;
                const p = Math.max(0, Math.min(100, rawPct));
                return (
                  <button key={evt.id} onClick={() => { setActiveEvent(evt.id); setCurrentTime(Math.round(p / 100 * TOTAL)); }}
                    title={evt.title}
                    className="absolute -top-0.5 z-10 group"
                    style={{ left:`calc(${p}% - 3px)` }}>
                    <div className={cn('w-1.5 h-4 rounded-sm opacity-70 hover:opacity-100 transition-all hover:scale-110', sigBg[evt.significance])} />
                  </button>
                );
              })}
              {/* Track */}
              <div className="h-2 bg-surface-raised rounded-full cursor-pointer mt-4 relative overflow-visible" onClick={scrub}>
                <div className="h-full bg-gradient-to-r from-accent/80 to-accent rounded-full" style={{ width:`${pct}%` }} />
                <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-accent shadow-glow-sm pointer-events-none"
                  style={{ left:`calc(${pct}% - 8px)` }} />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-2xs font-mono text-muted-foreground/50">14:30:00</span>
                <span className="text-2xs font-mono text-accent font-semibold">{formatVideoTimestamp(currentTime)}</span>
                <span className="text-2xs font-mono text-muted-foreground/50">15:00:00</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <button onClick={() => setCurrentTime(t => Math.max(0, t-30))} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors">
                  <SkipBack className="w-4 h-4" />
                </button>
                <button onClick={() => setPlaying(p => !p)}
                  className="w-11 h-11 rounded-xl flex items-center justify-center bg-accent text-accent-foreground hover:bg-accent-glow transition-all shadow-glow-sm active:scale-95">
                  {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
                <button onClick={() => setCurrentTime(t => Math.min(TOTAL, t+30))} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors">
                  <SkipForward className="w-4 h-4" />
                </button>
                <div className="flex items-center bg-surface border border-border rounded-lg overflow-hidden ml-2">
                  {SPEEDS.map(s => (
                    <button key={s} onClick={() => setSpeed(s)}
                      className={cn('px-2.5 py-1.5 text-xs transition-colors border-r border-border last:border-r-0',
                        speed === s ? 'bg-accent/15 text-accent' : 'text-muted-foreground hover:text-foreground')}>
                      {s}×
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button onClick={() => setZoom(z => Math.max(1, z-0.25))} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground border border-border hover:border-accent/30 transition-colors">
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono text-muted-foreground/60 w-9 text-center">{zoom.toFixed(2)}×</span>
                <button onClick={() => setZoom(z => Math.min(4, z+0.25))} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground border border-border hover:border-accent/30 transition-colors">
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-5 bg-border mx-1" />
                <button onClick={addBookmark} title="B" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border hover:border-primary/30 transition-colors">
                  <Bookmark className="w-3.5 h-3.5" /> Mark
                </button>
                <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border transition-colors">
                  <Tag className="w-3.5 h-3.5" /> Tag
                </button>
                <button className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground border border-border transition-colors">
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p className="text-2xs text-muted-foreground/25 mt-1.5 text-center font-mono">
              Space · J/L ±10s · ←→ frame · B bookmark
            </p>
          </div>
        )}
      </div>

      {/* ─── Right: detections ───────────────────────────────────── */}
      <div className="w-56 shrink-0 border-l flex flex-col overflow-hidden" style={{ borderColor:'var(--border)', background:'var(--bg-base)' }}>
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold">Detections</span>
          </div>
          <p className="text-2xs text-muted-foreground mt-0.5 font-mono">@ {formatVideoTimestamp(currentTime)}</p>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-4">
          {/* Current frame detections */}
          <div>
            <p className="text-2xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">Current Frame</p>
            {currentDetections.length === 0 ? (
              <p className="text-2xs text-muted-foreground/40 italic font-mono">No detections at this time</p>
            ) : (
              <div className="space-y-1">
                {currentDetections.map((d, i) => (
                  <motion.div key={d.trackId ?? i}
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 p-2 rounded-lg border"
                    style={{ background: `${d.color}10`, borderColor: `${d.color}40` }}>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color, boxShadow: `0 0 6px ${d.color}` }} />
                    <span className="text-xs font-medium flex-1" style={{ color: d.color }}>{d.label}</span>
                    <span className="text-xs font-mono font-bold" style={{ color: d.color }}>{d.confidence}%</span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* All tracked objects */}
          <div>
            <p className="text-2xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">All Tracked</p>
            {allObjects.filter(o => !['Suspect α','Suspect β','Person A','Bystander'].includes(o.label)).map((obj, i) => (
              <motion.div key={obj.label} initial={{ opacity:0, x:8 }} animate={{ opacity:1, x:0 }} transition={{ delay: i*0.06 }}
                className="flex items-center justify-between p-2 rounded-lg border mb-1.5 cursor-pointer"
                style={{ background: 'var(--bg-surface)', borderColor: `${obj.color}40` }}>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: obj.color }} />
                  <span className="text-xs">{obj.label}</span>
                </div>
                <ConfidenceBadge score={obj.maxConf} size="sm" showLabel={false} />
              </motion.div>
            ))}
          </div>

          {/* Persons */}
          <div>
            <p className="text-2xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">Persons</p>
            {suspects.map((s,i) => (
              <motion.div key={s.id} initial={{ opacity:0, x:8 }} animate={{ opacity:1, x:0 }} transition={{ delay: i*0.1 }}
                className="flex items-center gap-2 p-2 rounded-lg border mb-1.5 hover:border-warning/35 cursor-pointer"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0">
                  <img src={s.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 border-2 border-warning/60 rounded-lg" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{s.label}</p>
                  <ConfidenceBadge score={s.confidenceScore} size="sm" />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Active event card */}
          {activeEvent && timeline.filter(t => t.id === activeEvent).map(evt => (
            <div key={evt.id} className="p-3 rounded-xl bg-accent/6 border border-accent/20">
              <div className="flex items-center gap-1.5 mb-1">
                <div className={cn('w-1.5 h-1.5 rounded-full', sigBg[evt.significance])} />
                <span className="text-2xs font-mono text-muted-foreground/60">{formatTimestamp(evt.timestamp,'HH:mm:ss')}</span>
              </div>
              <p className="text-xs font-semibold mb-1">{evt.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{evt.description}</p>
              <div className="flex items-center gap-2 mt-2">
                <ConfidenceBadge score={evt.confidence} size="sm" />
                {evt.verified && <span className="text-2xs text-success flex items-center gap-1"><CheckCircle className="w-2.5 h-2.5" /> Verified</span>}
              </div>
              {evt.frameUrl && (
                <div className="mt-2 rounded-lg overflow-hidden">
                  <img src={evt.frameUrl} alt="Frame" className="w-full h-20 object-cover" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Notes */}
        <div className="p-3 border-t border-border space-y-2">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Investigation notes…"
            rows={3}
            className="w-full px-2.5 py-2 text-xs bg-surface border border-border rounded-lg text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent/40 resize-none font-mono leading-relaxed" />
          <button onClick={saveNote}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-surface border border-border text-muted-foreground hover:text-foreground hover:border-accent/30 transition-colors">
            <FileText className="w-3.5 h-3.5" /> Save Note
          </button>
        </div>
      </div>
    </div>
  );
}
