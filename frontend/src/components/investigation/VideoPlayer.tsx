'use client';

import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { cn } from '@/lib/utils';

export interface VideoPlayerHandle {
  seek: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  setPlaybackRate: (rate: number) => void;
  getCurrentTime: () => number;
}

export interface Detection {
  label: string;
  confidence: number;
  x: number; // 0-1 relative
  y: number;
  w: number;
  h: number;
  color: string;
  trackId?: string;
}

interface VideoPlayerProps {
  src?: string;
  thumbnailUrl?: string;
  isActive: boolean;
  playing: boolean;
  currentTime: number;
  zoom?: number;
  showOverlays?: boolean;
  detections?: Detection[];
  cameraId?: string;
  cameraName?: string;
  duration?: number;
  onTimeUpdate?: (t: number) => void;
  onSelect?: () => void;
  className?: string;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(function VideoPlayer(
  {
    src,
    thumbnailUrl,
    isActive,
    playing,
    currentTime,
    zoom = 1,
    showOverlays = true,
    detections,
    cameraId,
    cameraName,
    duration = 1800,
    onTimeUpdate,
    onSelect,
    className,
  },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastBoxesRef = useRef<Detection[]>([]);

  // Expose control handle
  useImperativeHandle(ref, () => ({
    seek: (s: number) => { if (videoRef.current) videoRef.current.currentTime = s; },
    play: () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
    setPlaybackRate: (r: number) => { if (videoRef.current) videoRef.current.playbackRate = r; },
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
  }));

  // Sync play/pause from parent state
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    if (playing) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [playing, src]);

  // Sync seek from parent scrubber
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    if (Math.abs(v.currentTime - currentTime) > 0.5) {
      v.currentTime = currentTime;
    }
  }, [currentTime, src]);

  // Smoothly lerp box positions for fluid animation
  const lerpBoxes = useCallback((current: Detection[], target: Detection[]): Detection[] => {
    if (current.length !== target.length) return target;
    return target.map((box, i) => {
      const prev = current[i];
      if (!prev || prev.trackId !== box.trackId) return box;
      const t = 0.15;
      return {
        ...box,
        x: prev.x + (box.x - prev.x) * t,
        y: prev.y + (box.y - prev.y) * t,
        w: prev.w + (box.w - prev.w) * t,
        h: prev.h + (box.h - prev.h) * t,
      };
    });
  }, []);

  // Draw bounding boxes on canvas overlay
  const drawBoxes = useCallback((boxes: Detection[]) => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;
    const { width: W, height: H } = container.getBoundingClientRect();
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    if (!showOverlays || boxes.length === 0) return;

    boxes.forEach(({ label, confidence, x, y, w, h, color }) => {
      const px = x * W, py = y * H, pw = w * W, ph = h * H;

      // Glow outer rect
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.25;
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.strokeRect(px - 1, py - 1, pw + 2, ph + 2);

      // Main box
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.strokeRect(px, py, pw, ph);
      ctx.shadowBlur = 0;

      // Corner markers
      const cs = 10;
      ctx.lineWidth = 3;
      [[px, py], [px+pw, py], [px, py+ph], [px+pw, py+ph]].forEach(([cx, cy], qi) => {
        const sx = qi % 2 === 0 ? 1 : -1;
        const sy = qi < 2 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(cx, cy + sy * cs);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + sx * cs, cy);
        ctx.stroke();
      });

      // Label background
      const text = `${label}  ${confidence}%`;
      ctx.font = 'bold 11px "JetBrains Mono", "Fira Mono", monospace';
      const tw = ctx.measureText(text).width;
      const lx = px - 1, ly = py - 20;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.roundRect(lx, ly, tw + 10, 17, 3);
      ctx.fill();

      // Label text
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000';
      ctx.fillText(text, lx + 5, ly + 12);
    });
  }, [showOverlays]);

  // Animation loop
  useEffect(() => {
    let active = true;
    const loop = () => {
      if (!active) return;
      const target = detections ?? [];
      const smoothed = lerpBoxes(lastBoxesRef.current, target);
      lastBoxesRef.current = smoothed;
      drawBoxes(smoothed);
      const v = videoRef.current;
      if (v && onTimeUpdate) onTimeUpdate(v.currentTime);
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => { active = false; cancelAnimationFrame(animFrameRef.current); };
  }, [drawBoxes, detections, lerpBoxes, onTimeUpdate]);

  return (
    <div
      onClick={onSelect}
      className={cn(
        'relative rounded-xl overflow-hidden bg-black cursor-pointer border-2 transition-all duration-150 group',
        isActive ? 'border-accent/60' : 'border-border/50 hover:border-border',
        className
      )}
    >
      {/* CRT Scanlines */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
        }}
      />

      {/* Video element */}
      {src ? (
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-cover"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
          muted
          playsInline
          preload="metadata"
          loop
        />
      ) : (
        <div className="w-full h-full min-h-[180px] relative flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={cameraName}
              className="w-full h-full object-cover"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 opacity-30">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.893L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
              <span className="text-xs font-mono">No video source</span>
            </div>
          )}
          {/* Fake shimmer when "playing" */}
          {playing && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.015] to-transparent animate-[shimmer_2s_infinite]" />
          )}
        </div>
      )}

      {/* Canvas overlay for AI detections */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-20"
      />

      {/* Camera HUD top-left */}
      <div className="absolute top-2 left-2 z-30 flex items-center gap-1.5">
        <div
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            playing && isActive ? 'bg-danger animate-pulse' : 'bg-muted-foreground/60'
          )}
        />
        <span className="text-[10px] font-mono text-white/80 bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm">
          {cameraId ?? 'CAM'}
        </span>
        {playing && isActive && (
          <span className="text-[10px] font-mono text-danger/90 bg-black/60 px-1 py-0.5 rounded backdrop-blur-sm animate-pulse">
            ● REC
          </span>
        )}
      </div>

      {/* Detection count badge */}
      {showOverlays && (detections?.length ?? 0) > 0 && (
        <div className="absolute top-2 right-2 z-30">
          <span className="text-[10px] font-mono font-bold text-white bg-accent/80 px-1.5 py-0.5 rounded backdrop-blur-sm">
            {detections!.length} detected
          </span>
        </div>
      )}

      {/* Active ring */}
      {isActive && (
        <div className="absolute inset-0 ring-2 ring-accent/60 ring-inset pointer-events-none rounded-xl z-30" />
      )}

      {/* Bottom HUD */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2 z-30">
        <p className="text-[10px] text-white/70 font-mono truncate">{cameraName}</p>
      </div>

      {/* Hover play overlay */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
          <div className="w-12 h-12 rounded-full bg-accent/70 flex items-center justify-center backdrop-blur-sm shadow-lg">
            <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
});
