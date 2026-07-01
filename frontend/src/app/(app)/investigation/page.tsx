"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import CrimeScene, { SceneMarker } from "@/components/scene3d/CrimeScene";
import {
  Search,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Layers,
  Filter,
  Tag,
  Bookmark,
  FileText,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  Film,
  Pin,
  SplitSquareHorizontal,
  BrainCircuit,
  CheckCircle,
  AlertTriangle,
  Target,
} from "lucide-react";
import {
  mockEvidence,
  mockTimeline,
  mockSuspects,
  mockCases,
} from "@/lib/mockData";
import { casesApi, evidenceApi, toCaseFrontend, toEvidenceFrontend } from "@/lib/api";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  cn,
  formatTimestamp,
  formatDuration,
  formatVideoTimestamp,
} from "@/lib/utils";
import type { Case, Evidence } from "@/types";

type PanelMode = "single" | "split" | "quad" | "scene";

export default function InvestigationPage() {
  const [panelMode, setPanelMode] = useState<PanelMode>("split");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(870);
  const [activeTimestamp, setActiveTimestamp] = useState<string | null>("tl-003");
  const [selectedCamera, setSelectedCamera] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // 3D scene state
  const [selectedMarker, setSelectedMarker] = useState<SceneMarker | null>(null);
  const [highlightedMarkerId, setHighlightedMarkerId] = useState<string | null>(null);
  const [cameraTarget, setCameraTarget] = useState<[number, number, number] | null>(null);

  const playInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────
  // Load the most recent active case from backend; fall back to mock data if
  // the backend is unavailable so the investigation page always shows something.
  const { data: casesData } = useQuery({
    queryKey: ['cases', 'investigation'],
    queryFn: () => casesApi.list({ page: 1, page_size: 1, status: 'active' }),
    retry: 1,
  });

  const activeCase: Case = useMemo(() => {
    const backendCase = casesData?.data?.[0];
    return backendCase ? toCaseFrontend(backendCase) : mockCases[0];
  }, [casesData]);

  const { data: evidenceData } = useQuery({
    queryKey: ['evidence', 'investigation', activeCase.id],
    queryFn: () => evidenceApi.list({ case_id: activeCase.id, page: 1 }),
    enabled: !!activeCase.id,
    retry: 1,
  });

  const caseEvidence: Evidence[] = useMemo(() => {
    const backendEvidence = evidenceData?.data;
    if (backendEvidence && backendEvidence.length > 0) {
      return backendEvidence
        .map(toEvidenceFrontend)
        .filter((e) => e.type === 'video' || e.type === 'bodycam');
    }
    return mockEvidence.filter(
      (e) => e.caseId === activeCase.id && (e.type === 'video' || e.type === 'bodycam'),
    );
  }, [evidenceData, activeCase.id]);

  // Timeline and suspects still use mock data — DB rows not yet seeded.
  // When backend routes are added they can replace these.
  const caseTimeline = mockTimeline.filter((t) => t.caseId === mockCases[0].id);
  const caseSuspects = mockSuspects.filter((s) => s.caseId === mockCases[0].id);

  const totalDuration = 1800;
  const progressPct = (currentTime / totalDuration) * 100;

  // Build 3D scene markers from suspects + evidence
  const sceneMarkers: SceneMarker[] = useMemo(() => {
    const markers: SceneMarker[] = [];
    caseSuspects.forEach((s, i) => {
      markers.push({
        id: s.id,
        label: s.label,
        position: [(-4 + i * 4), 0.5, (-2 + i * 2)] as [number, number, number],
        type: "person",
        confidence: s.confidenceScore,
        evidenceId: s.trackIds?.[0]?.evidenceId,
        color: "#FF6B35",
      });
    });
    caseEvidence.forEach((ev, i) => {
      markers.push({
        id: `ev-${ev.id}`,
        label: ev.originalName.split("–")[0].trim().slice(0, 20),
        position: [(i * 3 - 3), 0.25, (i * 2 - 4)] as [number, number, number],
        type: "evidence",
        evidenceId: ev.id,
        confidence: ev.aiResults?.confidence,
        color: "#FFD60A",
      });
    });
    return markers;
  }, [caseSuspects, caseEvidence]);

  // Simulated playback clock
  useEffect(() => {
    if (playing) {
      playInterval.current = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + playbackSpeed;
          if (next >= totalDuration) {
            setPlaying(false);
            return totalDuration;
          }
          return next;
        });
      }, 1000);
    } else {
      if (playInterval.current) clearInterval(playInterval.current);
    }
    return () => {
      if (playInterval.current) clearInterval(playInterval.current);
    };
  }, [playing, playbackSpeed, totalDuration]);

  // Auto-select nearest timeline event as playhead moves
  useEffect(() => {
    if (!playing) return;
    const timeSeconds = 14 * 3600 + currentTime;
    let nearest = caseTimeline[0];
    let minDist = Infinity;
    for (const ev of caseTimeline) {
      const evSec =
        new Date(ev.timestamp).getHours() * 3600 +
        new Date(ev.timestamp).getMinutes() * 60 +
        new Date(ev.timestamp).getSeconds();
      const dist = Math.abs(evSec - timeSeconds);
      if (dist < minDist) {
        minDist = dist;
        nearest = ev;
      }
    }
    if (nearest && nearest.id !== activeTimestamp) {
      setActiveTimestamp(nearest.id);
    }
  }, [currentTime, playing, caseTimeline]); // eslint-disable-line react-hooks/exhaustive-deps

  // When timeline event is clicked, fly 3D camera to related marker
  const handleTimelineClick = useCallback(
    (eventId: string) => {
      setActiveTimestamp(eventId);
      const event = caseTimeline.find((t) => t.id === eventId);
      if (!event) return;
      const marker = sceneMarkers.find(
        (m) => m.evidenceId === event.evidenceId || m.id === event.suspects?.[0]
      );
      if (marker) {
        setHighlightedMarkerId(marker.id);
        setCameraTarget(marker.position);
        setSelectedMarker(marker);
        if (panelMode !== "scene") setPanelMode("scene");
      }
    },
    [caseTimeline, sceneMarkers, panelMode]
  );

  const handleMarkerSelect = useCallback((marker: SceneMarker | null) => {
    setSelectedMarker(marker);
    setHighlightedMarkerId(marker?.id ?? null);
    if (marker?.evidenceId) {
      const ev = caseTimeline.find((t) => t.evidenceId === marker.evidenceId);
      if (ev) setActiveTimestamp(ev.id);
    }
  }, [caseTimeline]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: timeline & suspects panel */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col bg-[#070c19] overflow-hidden">
        {/* Case header */}
        <div className="p-4 border-b border-border">
          <p className="text-2xs font-mono text-muted-foreground/60 mb-1">
            {activeCase.caseNumber}
          </p>
          <h2 className="text-sm font-semibold leading-snug line-clamp-2">{activeCase.title}</h2>
          <div className="flex items-center gap-2 mt-2">
            <StatusBadge status={activeCase.status} />
            <ConfidenceBadge score={activeCase.confidenceScore} size="sm" showLabel={false} />
          </div>
        </div>

        {/* Suspects */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-3.5 h-3.5 text-accent/70" />
            <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
              Tracked Suspects
            </span>
          </div>
          <div className="space-y-2">
            {caseSuspects.map((s) => (
              <button
                key={s.id}
                onClick={() => handleTimelineClick(s.trackIds?.[0]?.evidenceId ?? s.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 p-2 rounded-lg bg-surface border transition-colors cursor-pointer text-left",
                  highlightedMarkerId === s.id
                    ? "border-accent/60 bg-accent/5"
                    : "border-border hover:border-accent/30"
                )}
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-surface-raised shrink-0">
                  <img src={s.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{s.label}</p>
                  <p className="text-2xs text-muted-foreground">{s.cameras.length} cameras</p>
                </div>
                <ConfidenceBadge score={s.confidenceScore} size="sm" showLabel={false} />
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-3.5 h-3.5 text-accent/70" />
              <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                Event Timeline
              </span>
            </div>
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-accent/20" />
              <div className="space-y-1 pl-2">
                {caseTimeline.map((event) => {
                  const isActive = event.id === activeTimestamp;
                  const significanceColor = {
                    critical: "border-danger text-danger",
                    high: "border-warning text-warning",
                    medium: "border-accent text-accent",
                    low: "border-muted text-muted-foreground",
                  }[event.significance];

                  return (
                    <button
                      key={event.id}
                      onClick={() => handleTimelineClick(event.id)}
                      className={cn(
                        "w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-all duration-150",
                        isActive
                          ? "bg-accent/10 border border-accent/30"
                          : "hover:bg-surface-raised border border-transparent"
                      )}
                    >
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5",
                          isActive ? "bg-accent border-accent" : significanceColor
                        )}
                      >
                        {event.verified ? (
                          <CheckCircle className="w-2.5 h-2.5 text-white" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-current" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-2xs font-mono text-muted-foreground/60">
                          {formatTimestamp(event.timestamp, "HH:mm:ss")}
                        </p>
                        <p className="text-xs font-medium text-foreground line-clamp-1">
                          {event.title}
                        </p>
                        <p className="text-2xs text-muted-foreground line-clamp-1">{event.source}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Center: video panels / 3D scene */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-[#080d1a] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Layout:</span>
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              {(["single", "split", "quad", "scene"] as PanelMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPanelMode(mode)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors border-r border-border last:border-r-0",
                    panelMode === mode
                      ? "bg-accent/15 text-accent"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {mode === "single" ? "1×" : mode === "split" ? "2×" : mode === "quad" ? "4×" : "3D"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors border border-border">
              <Filter className="w-3.5 h-3.5" />
              Detections
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors border border-border">
              <Layers className="w-3.5 h-3.5" />
              Overlays
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-accent hover:bg-accent/10 transition-colors border border-accent/25">
              <BrainCircuit className="w-3.5 h-3.5" />
              AI Mode
            </button>
          </div>
        </div>

        {/* Video panels or 3D scene */}
        {panelMode === "scene" ? (
          <div className="flex-1 p-3 overflow-hidden">
            <div className="w-full h-full rounded-xl overflow-hidden border border-border">
              <CrimeScene
                markers={sceneMarkers}
                highlightedId={highlightedMarkerId}
                cameraTarget={cameraTarget}
                onMarkerSelect={handleMarkerSelect}
              />
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "flex-1 p-3 overflow-hidden",
              panelMode === "quad"
                ? "grid grid-cols-2 grid-rows-2 gap-2"
                : panelMode === "split"
                  ? "grid grid-cols-2 gap-2"
                  : "flex"
            )}
          >
            {caseEvidence
              .slice(0, panelMode === "single" ? 1 : panelMode === "split" ? 2 : 4)
              .map((ev, idx) => (
                <VideoPanel
                  key={ev.id}
                  evidence={ev}
                  isActive={selectedCamera === idx}
                  onSelect={() => setSelectedCamera(idx)}
                  playing={playing && selectedCamera === idx}
                  currentTime={currentTime}
                  zoom={panelMode === "single" ? zoom : 1}
                  showOverlays
                />
              ))}
          </div>
        )}

        {/* Playback controls */}
        <div className="border-t border-border bg-[#080d1a] p-4 shrink-0">
          {/* Timeline scrubber */}
          <div className="mb-4 relative">
            {caseTimeline.map((event) => {
              const pct =
                ((new Date(event.timestamp).getHours() * 3600 +
                  new Date(event.timestamp).getMinutes() * 60 +
                  new Date(event.timestamp).getSeconds() -
                  14 * 3600) /
                  totalDuration) *
                100;
              const clampedPct = Math.max(0, Math.min(100, pct));
              const color = {
                critical: "bg-danger",
                high: "bg-warning",
                medium: "bg-accent",
                low: "bg-muted-foreground",
              }[event.significance];
              return (
                <button
                  key={event.id}
                  onClick={() => handleTimelineClick(event.id)}
                  className="absolute -top-1 z-10 group"
                  style={{ left: `${clampedPct}%` }}
                  title={event.title}
                >
                  <div className={cn("w-2 h-4 rounded-sm opacity-80 hover:opacity-100 hover:scale-110 transition-all", color)} />
                  <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-40 bg-surface border border-border rounded-lg p-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap overflow-hidden text-ellipsis">
                    {event.title}
                  </div>
                </button>
              );
            })}

            <div
              className="relative h-2 bg-surface-raised rounded-full cursor-pointer mt-4 overflow-visible"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                setCurrentTime(Math.round(pct * totalDuration));
              }}
            >
              <motion.div className="h-full bg-accent rounded-full" style={{ width: `${progressPct}%` }} />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-accent shadow-glow-sm transition-all"
                style={{ left: `calc(${progressPct}% - 7px)` }}
              />
            </div>

            <div className="flex justify-between mt-1">
              <span className="text-2xs font-mono text-muted-foreground">14:30:00</span>
              <span className="text-2xs font-mono text-accent">{formatVideoTimestamp(currentTime)}</span>
              <span className="text-2xs font-mono text-muted-foreground">15:00:00</span>
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentTime(Math.max(0, currentTime - 30))}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPlaying(!playing)}
                className="w-11 h-11 rounded-xl flex items-center justify-center bg-accent text-accent-foreground hover:bg-accent-glow transition-colors shadow-glow-sm"
              >
                {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button
                onClick={() => setCurrentTime(Math.min(totalDuration, currentTime + 30))}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className="ml-2 px-2 py-1 text-xs bg-surface border border-border rounded-lg text-foreground focus:outline-none cursor-pointer"
              >
                {[0.25, 0.5, 1, 2, 4].map((s) => (
                  <option key={s} value={s} className="bg-[#0D1526]">
                    {s}×
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom(Math.max(1, zoom - 0.25))}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors border border-border"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono text-muted-foreground w-10 text-center">
                {zoom.toFixed(2)}×
              </span>
              <button
                onClick={() => setZoom(Math.min(4, zoom + 0.25))}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors border border-border"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-6 bg-border mx-1" />

              <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors border border-border">
                <Bookmark className="w-3.5 h-3.5" />
                Bookmark
              </button>
              <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors border border-border">
                <Tag className="w-3.5 h-3.5" />
                Annotate
              </button>
              <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors border border-border">
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right: detections panel */}
      <div className="w-64 shrink-0 border-l border-border flex flex-col bg-[#070c19] overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold">Detections</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Frame @ {formatVideoTimestamp(currentTime)}</p>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2">
          {/* Persons */}
          <div>
            <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Persons ({caseSuspects.length})
            </p>
            {caseSuspects.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => handleTimelineClick(s.id)}
                className={cn(
                  "flex items-center gap-2.5 p-2 rounded-lg border mb-2 transition-colors cursor-pointer",
                  highlightedMarkerId === s.id
                    ? "bg-accent/8 border-accent/40"
                    : "bg-surface border-border hover:border-accent/30"
                )}
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-raised shrink-0 relative">
                  <img src={s.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 border-2 border-warning/60 rounded-lg" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{s.label}</p>
                  <ConfidenceBadge score={s.confidenceScore} size="sm" />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Objects */}
          <div>
            <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Objects
            </p>
            {[
              { label: "Backpack", confidence: 96, color: "border-success/50" },
              { label: "Firearm", confidence: 89, color: "border-danger/50" },
              { label: "Mobile Phone", confidence: 74, color: "border-accent/50" },
              { label: "Train", confidence: 99, color: "border-muted" },
            ].map((obj, i) => (
              <motion.div
                key={obj.label}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
                className={cn(
                  "flex items-center justify-between p-2 rounded-lg bg-surface border mb-1.5 hover:border-accent/30 transition-colors cursor-pointer",
                  obj.color
                )}
              >
                <span className="text-xs text-foreground">{obj.label}</span>
                <ConfidenceBadge score={obj.confidence} size="sm" showLabel={false} />
              </motion.div>
            ))}
          </div>

          {/* Active event */}
          {activeTimestamp && (
            <div>
              <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Active Event
              </p>
              {caseTimeline
                .filter((t) => t.id === activeTimestamp)
                .map((event) => (
                  <div key={event.id} className="p-3 rounded-lg bg-accent/8 border border-accent/25">
                    <p className="text-xs font-semibold text-foreground mb-1">{event.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{event.description}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <ConfidenceBadge score={event.confidence} size="sm" />
                      {event.verified && (
                        <span className="text-2xs text-success flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Verified
                        </span>
                      )}
                    </div>
                    {event.location && (
                      <p className="text-2xs text-muted-foreground/60 mt-1.5 flex items-center gap-1">
                        <Pin className="w-2.5 h-2.5" /> {event.location}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="p-3 border-t border-border">
          <textarea
            placeholder="Add investigation notes..."
            rows={3}
            className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent/40 resize-none"
          />
          <button className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-surface border border-border text-muted-foreground hover:text-foreground hover:border-accent/30 transition-colors">
            <FileText className="w-3.5 h-3.5" />
            Save Note
          </button>
        </div>
      </div>
    </div>
  );
}

// Video Panel component
interface VideoPanelProps {
  evidence: any;
  isActive: boolean;
  onSelect: () => void;
  playing: boolean;
  currentTime: number;
  zoom?: number;
  showOverlays?: boolean;
}

function VideoPanel({
  evidence: ev,
  isActive,
  onSelect,
  playing,
  currentTime,
  zoom = 1,
  showOverlays,
}: VideoPanelProps) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative rounded-xl overflow-hidden bg-black cursor-pointer border-2 transition-all duration-150 group",
        isActive ? "border-accent/60" : "border-border/50 hover:border-border"
      )}
    >
      <div className="relative w-full h-full overflow-hidden" style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}>
        {ev.thumbnailUrl ? (
          <img src={ev.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#050911]">
            <Film className="w-10 h-10 text-muted-foreground/20" />
          </div>
        )}

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)",
          }}
        />

        {showOverlays && isActive && (
          <>
            <div className="absolute border-2 border-warning/80 rounded" style={{ left: "28%", top: "20%", width: "18%", height: "55%" }}>
              <span className="absolute -top-5 left-0 text-2xs bg-warning text-black px-1 rounded font-bold whitespace-nowrap">
                Suspect α 94%
              </span>
            </div>
            <div className="absolute border-2 border-orange-400/80 rounded" style={{ left: "58%", top: "25%", width: "14%", height: "48%" }}>
              <span className="absolute -top-5 left-0 text-2xs bg-orange-400 text-black px-1 rounded font-bold whitespace-nowrap">
                Suspect β 88%
              </span>
            </div>
            <div className="absolute border-2 border-success/70 rounded" style={{ left: "30%", top: "58%", width: "10%", height: "18%" }}>
              <span className="absolute -top-5 left-0 text-2xs bg-success text-white px-1 rounded font-bold">
                Backpack 96%
              </span>
            </div>
          </>
        )}
      </div>

      <div className="absolute top-2 left-2 flex items-center gap-1.5">
        <div className={cn("w-1.5 h-1.5 rounded-full", playing && isActive ? "bg-danger animate-pulse" : "bg-muted-foreground")} />
        <span className="text-2xs font-mono text-white/80 bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm">
          {ev.metadata?.cameraId || ev.id.toUpperCase()}
        </span>
      </div>

      {isActive && (
        <div className="absolute inset-0 ring-2 ring-accent/60 ring-inset pointer-events-none rounded-xl" />
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2">
        <p className="text-2xs text-white/70 font-mono truncate">{ev.originalName}</p>
        <p className="text-2xs font-mono text-white/50">
          {formatVideoTimestamp(currentTime)} / {formatDuration(ev.duration || 1800)}
        </p>
      </div>

      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="w-10 h-10 rounded-full bg-accent/70 flex items-center justify-center backdrop-blur-sm">
          <Play className="w-4 h-4 text-white ml-0.5" />
        </div>
      </div>
    </div>
  );
}
