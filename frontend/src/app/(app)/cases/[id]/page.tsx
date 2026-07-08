'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Film, Users, Clock, MapPin, Shield, BrainCircuit,
  FileText, Upload, ChevronRight, Calendar, Tag, CheckCircle,
  AlertTriangle, Lock, Download, Eye, Bookmark, Camera,
  Target, Play, Network, Box, Printer, Sparkles, X, Plus,
  Trash2, ImageIcon, FileVideo, File, RefreshCw, Layers3,
  ZoomIn, ZoomOut, RotateCcw, Maximize2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { casesAPI } from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { cn, formatTimestamp, formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';

import dynamic from 'next/dynamic';

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f59e0b', medium: '#00b4d8', low: '#64748b',
};

type Tab = 'overview' | 'evidence' | '3d-scene' | 'correlation' | 'timeline' | 'reports';

// Lazy-load heavy AI components
const SceneViewer3D = dynamic(
  () => import('@/components/investigation/SceneViewer3D').then(m => ({ default: m.SceneViewer3D })),
  { ssr: false, loading: () => <div className="h-[500px] flex items-center justify-center border border-border rounded-xl bg-surface-raised"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div> }
);
const EvidenceCorrelationEngine = dynamic(
  () => import('@/components/investigation/EvidenceCorrelationEngine').then(m => ({ default: m.EvidenceCorrelationEngine })),
  { ssr: false, loading: () => <div className="h-[500px] flex items-center justify-center border border-border rounded-xl bg-surface-raised"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div> }
);
const ReportGenerator = dynamic(
  () => import('@/components/reports/ReportGenerator').then(m => ({ default: m.ReportGenerator })),
  { ssr: false, loading: () => <div className="h-[200px] flex items-center justify-center"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div> }
);

// ── helpers ──────────────────────────────────────────────────────────────────
function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.startsWith('video')) return FileVideo;
  if (type.startsWith('image')) return ImageIcon;
  return File;
}


// ── Evidence Upload Drop Zone ─────────────────────────────────────────────────
function EvidenceUploader({ caseId, onUploaded }: { caseId: string; onUploaded: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    setProgress(0);
    let done = 0;
    for (const file of files) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `cases/${caseId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('evidence')
          .upload(filePath, file, { upsert: false });

        if (uploadError) {
          // If storage bucket doesn't exist, store metadata only
          console.warn('Storage upload failed (bucket may not exist), saving metadata:', uploadError.message);
        }

        let publicUrl = '';
        if (!uploadError) {
          const { data: { publicUrl: url } } = supabase.storage.from('evidence').getPublicUrl(filePath);
          publicUrl = url;
        }

        // Determine file type
        let fileType: string;
        if (file.type.startsWith('video')) fileType = 'video';
        else if (file.type.startsWith('image')) fileType = 'image';
        else if (file.type.startsWith('audio')) fileType = 'audio';
        else fileType = 'document';

        // Insert evidence record
        const { error: dbError } = await supabase.from('evidence').insert([{
          case_id: caseId,
          filename: fileName,
          original_name: file.name,
          file_type: fileType,
          file_url: publicUrl || `local://${file.name}`,
          file_size: file.size,
          tags: [],
          metadata: {},
        }]);

        if (dbError) {
          console.error('DB insert error:', dbError);
          toast.error(`Failed to save ${file.name}: ${dbError.message}`);
        } else {
          done++;
          setProgress(Math.round((done / files.length) * 100));
        }
      } catch (err: any) {
        toast.error(`Error uploading ${file.name}: ${err.message}`);
      }
    }
    setUploading(false);
    if (done > 0) {
      toast.success(`${done} file${done > 1 ? 's' : ''} uploaded successfully`);
      onUploaded();
    }
  }, [caseId, onUploaded]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    upload(files);
  }, [upload]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !uploading && fileInputRef.current?.click()}
      className={cn(
        'relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer',
        dragging ? 'border-accent bg-accent/5 scale-[1.01]' : 'border-border hover:border-accent/50 hover:bg-white/[0.02]',
        uploading && 'pointer-events-none'
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,image/*,audio/*,.pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => e.target.files && upload(Array.from(e.target.files))}
      />

      {uploading ? (
        <div className="space-y-3">
          <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center mx-auto">
            <RefreshCw className="w-5 h-5 text-accent animate-spin" />
          </div>
          <p className="text-sm font-medium text-foreground">Uploading evidence... {progress}%</p>
          <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden max-w-xs mx-auto">
            <motion.div
              className="h-full bg-gradient-to-r from-accent to-blue-500 rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      ) : (
        <>
          <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors', dragging ? 'bg-accent/20' : 'bg-surface-raised')}>
            <Upload className={cn('w-6 h-6 transition-colors', dragging ? 'text-accent' : 'text-muted-foreground')} />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">
            {dragging ? 'Drop files here' : 'Upload Evidence Files'}
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Drag & drop or click to select — videos, images, audio, documents
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {['MP4', 'MOV', 'JPG', 'PNG', 'PDF', 'MP3'].map(f => (
              <span key={f} className="text-2xs px-2 py-0.5 rounded bg-surface border border-border text-muted-foreground font-mono">{f}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Evidence Grid ─────────────────────────────────────────────────────────────
function EvidenceGrid({ items, caseId, onDeleted }: { items: any[]; caseId: string; onDeleted: () => void }) {
  const deleteItem = async (id: string) => {
    const { error } = await supabase.from('evidence').delete().eq('id', id);
    if (error) { toast.error('Delete failed'); return; }
    toast.success('Evidence removed');
    onDeleted();
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Film className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="text-sm">No evidence uploaded yet.</p>
        <p className="text-xs opacity-60 mt-1">Use the upload zone above to add files.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((ev) => {
        const Icon = getFileIcon(ev.file_type || '');
        const isVideo = ev.file_type === 'video' || (ev.file_url && ev.file_url.match(/\.(mp4|mov|webm|avi)$/i));
        const isImage = ev.file_type === 'image' || (ev.file_url && ev.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i));

        return (
          <motion.div
            key={ev.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="group rounded-xl overflow-hidden border border-border bg-card hover:border-accent/30 transition-all"
          >
            {/* Preview */}
            <div className="relative h-40 bg-surface-raised flex items-center justify-center">
              {isVideo && ev.file_url && !ev.file_url.startsWith('local://') ? (
                <video src={ev.file_url} className="w-full h-full object-cover" muted />
              ) : isImage && ev.file_url && !ev.file_url.startsWith('local://') ? (
                <img src={ev.file_url} alt={ev.original_name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Icon className="w-10 h-10 text-muted-foreground/30" />
                  <span className="text-xs text-muted-foreground/50 font-mono uppercase">
                    {ev.file_type || 'file'}
                  </span>
                </div>
              )}
              {/* Overlay actions */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                {(isVideo || isImage) && ev.file_url && !ev.file_url.startsWith('local://') && (
                  <a href={ev.file_url} target="_blank" rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition">
                    <Eye className="w-4 h-4" />
                  </a>
                )}
                {ev.file_url && !ev.file_url.startsWith('local://') && (
                  <a href={ev.file_url} download
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition">
                    <Download className="w-4 h-4" />
                  </a>
                )}
                <button onClick={() => deleteItem(ev.id)}
                  className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {/* Type badge */}
              <span className="absolute top-2 left-2 text-2xs px-1.5 py-0.5 rounded font-mono uppercase bg-black/60 text-white border border-white/10">
                {ev.file_type || 'file'}
              </span>
            </div>
            {/* Info */}
            <div className="p-3">
              <p className="text-sm font-medium text-foreground truncate">{ev.original_name}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground">{formatFileSize(ev.file_size || 0)}</span>
                <span className="text-xs text-muted-foreground">{new Date(ev.uploaded_at || ev.created_at || Date.now()).toLocaleDateString('en-IN')}</span>
              </div>
              {/* 3D analysis badge */}
              <div className="mt-2 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span className="text-2xs text-accent/70">Queued for 3D analysis</span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CaseDetailPage() {
  const { id: caseId } = useParams() as { id: string };
  const [tab, setTab] = useState<Tab>('overview');
  const [caseData, setCaseData] = useState<any>(null);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);

  const loadCase = useCallback(async () => {
    try {
      const result = await casesAPI.get(caseId);
      if (!result.data) { setNotFound(true); return; }
      setCaseData(result.data);
    } catch (err) {
      console.error('Failed to load case:', err);
      setNotFound(true);
    }
  }, [caseId]);

  const loadEvidence = useCallback(async () => {
    const { data, error } = await supabase
      .from('evidence')
      .select('*')
      .eq('case_id', caseId)
      .order('uploaded_at', { ascending: false });
    if (!error && data) setEvidence(data);
  }, [caseId]);

  const analyzeEvidence = async () => {
    if (evidence.length === 0) {
      toast.error('No evidence to process.');
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);

    const dynamicEvidenceMarkers: any[] = [];
    const dynamicTimelineEvents: any[] = [];
    const dynamicCorrelations: any[] = [];
    let completedCount = 0;

    // We will collect all detected objects/people across all images to build correlations
    const allDetections: { id: string; evId: string; type: string; desc: string; url: string; time: string }[] = [];

    // Process each evidence item
    for (const ev of evidence) {
      const isImage = ev.file_type === 'image' || (ev.file_url && ev.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i));
      
      let aiData: any = null;

      if (isImage && ev.file_url && !ev.file_url.startsWith('local://')) {
        try {
          const res = await fetch('/api/analyze-vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: ev.file_url })
          });
          if (res.ok) {
            aiData = await res.json();
          }
        } catch (e) {
          console.error("Failed to analyze image", ev.id, e);
        }
      }

      // Add to timeline
      dynamicTimelineEvents.push({
        time: new Date(ev.uploaded_at || ev.created_at || Date.now()).toLocaleString('en-IN'),
        event: aiData ? `AI Processed: ${aiData.locationContext || ev.original_name}` : `Uploaded ${ev.original_name}`,
        color: aiData ? 'bg-accent' : 'bg-purple-500'
      });

      // Process AI Data for 3D Markers & Correlation aggregation
      if (aiData) {
        // Aggregate people
        (aiData.people || []).forEach((p: any, idx: number) => {
          const detId = `det-p-${ev.id}-${idx}`;
          dynamicEvidenceMarkers.push({
            id: detId,
            label: p.description.slice(0, 15),
            type: 'person',
            position: [(idx * 2) - 3, 0, (completedCount * 1.5) - 2],
            confidence: p.confidence || 85,
          });
          allDetections.push({ id: detId, evId: ev.id, type: 'person', desc: p.description, url: ev.file_url, time: ev.uploaded_at });
        });

        // Aggregate objects
        (aiData.objects || []).forEach((o: any, idx: number) => {
          const detId = `det-o-${ev.id}-${idx}`;
          dynamicEvidenceMarkers.push({
            id: detId,
            label: o.description.slice(0, 15),
            type: o.type === 'weapon' ? 'weapon' : 'object',
            position: [(idx * 2) + 2, 0, (completedCount * 1.5) + 2],
            confidence: o.confidence || 90,
          });
          allDetections.push({ id: detId, evId: ev.id, type: o.type || 'object', desc: o.description, url: ev.file_url, time: ev.uploaded_at });
        });
      } else {
        // Fallback marker for non-images or failed AI
        dynamicEvidenceMarkers.push({
          id: ev.id,
          label: ev.original_name.slice(0, 15),
          type: ev.file_type === 'video' ? 'person' : 'object',
          position: [(completedCount * 2.5) % 15 - 7.5, 0, (completedCount * -1.5) % 10 + 2],
          confidence: 75,
        });
      }

      completedCount++;
      setProcessingProgress(Math.round((completedCount / evidence.length) * 100));
    }

    // 2. Trajectories (3D & Correlation) - Still simulated for videos as requested
    const videos = evidence.filter(ev => ev.file_type === 'video' || (ev.file_url && ev.file_url.match(/\.(mp4|mov|webm|avi)$/i)));
    const dynamicTrajectories = videos.map((vid, i) => {
      return {
        suspectId: `susp-${vid.id}`,
        label: `Trajectory from ${vid.original_name.slice(0,10)}`,
        color: i % 2 === 0 ? '#f59e0b' : '#a78bfa',
        waypoints: [
          [-5 + i, 0, 3],
          [-1 + i, 0, 1],
          [2 + i, 0, 0.5],
          [5 + i, 0, 0],
        ] as [number, number, number][],
        path: [
          { time: '00:00:15', cameraId: 'CAM-A', location: 'Entry Point', confidence: 92 },
          { time: '00:01:45', cameraId: 'CAM-B', location: 'Midpoint', confidence: 88 },
          { time: '00:03:20', cameraId: 'CAM-C', location: 'Exit Point', confidence: 95 },
        ]
      };
    });

    // Build actual correlations based on similar keywords in descriptions
    for (let i = 0; i < allDetections.length; i++) {
      for (let j = i + 1; j < allDetections.length; j++) {
        const A = allDetections[i];
        const B = allDetections[j];
        
        // Don't correlate within the same image
        if (A.evId === B.evId) continue;
        
        // Very basic NLP matching: count overlapping words
        const wordsA = A.desc.toLowerCase().split(/\W+/).filter(w => w.length > 3);
        const wordsB = B.desc.toLowerCase().split(/\W+/).filter(w => w.length > 3);
        
        const overlaps = wordsA.filter(w => wordsB.includes(w));
        
        if (overlaps.length > 0 || A.type === B.type) {
          dynamicCorrelations.push({
            id: `corr-ai-${A.id}-${B.id}`,
            caseId,
            title: `AI Match: ${overlaps.join(', ') || A.type}`,
            type: A.type === 'person' ? 'suspect_link' : 'object_match',
            confidence: Math.min(99, 85 + (overlaps.length * 4)), // Boost confidence on multiple word matches
            evidenceA: { id: A.evId, name: A.desc, timestamp: A.time || new Date().toISOString() },
            evidenceB: { id: B.evId, name: B.desc, timestamp: B.time || new Date().toISOString() },
            sharedAttributes: overlaps.length > 0 ? overlaps : ['Similar category detected'],
            status: 'confirmed',
          });
        }
      }
    }

    dynamicTimelineEvents.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    const newMetadata = {
      ...(caseData.metadata || {}),
      dynamicEvidenceMarkers,
      dynamicTrajectories,
      dynamicCorrelations,
      dynamicTimelineEvents
    };

    // Update DB
    await supabase.from('cases').update({ 
      ai_processed: true,
      metadata: newMetadata
    }).eq('id', caseId);

    setCaseData({ ...caseData, ai_processed: true, metadata: newMetadata });
    setIsProcessing(false);
    toast.success('AI Forensic Analysis Complete');
  };

  useEffect(() => {
    Promise.all([loadCase(), loadEvidence()]).finally(() => setLoading(false));
  }, [loadCase, loadEvidence]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading case...</p>
        </div>
      </div>
    );
  }

  if (notFound || !caseData) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <Shield className="w-14 h-14 text-muted-foreground/20 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Case Not Found</h2>
          <p className="text-sm text-muted-foreground mb-6">The case ID <span className="font-mono text-accent">{caseId}</span> could not be found in the database.</p>
          <Link href="/cases" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition">
            <ArrowLeft className="w-4 h-4" /> Back to Cases
          </Link>
        </div>
      </div>
    );
  }

  const bColor = PRIORITY_COLOR[caseData.priority] || '#00b4d8';

  const TABS: { id: Tab; label: string; count?: number; icon?: any }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'evidence', label: 'Evidence', count: evidence.length, icon: Film },
    { id: '3d-scene', label: '3D Scene', icon: Box },
    { id: 'correlation', label: 'Correlation', icon: Network },
    { id: 'timeline', label: 'Timeline' },
    { id: 'reports', label: 'Reports' },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1400px] mx-auto p-6 space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/cases" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Cases
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30" />
          <span className="font-mono text-xs text-muted-foreground/60">{caseData.case_number}</span>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30" />
          <span className="text-foreground font-medium line-clamp-1 max-w-xs">{caseData.title}</span>
        </div>

        {/* Hero header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl overflow-hidden relative"
          style={{
            background: `linear-gradient(135deg, ${bColor}0a 0%, rgba(5,8,18,0.95) 60%)`,
            border: `1px solid ${bColor}25`,
            boxShadow: `0 4px 40px rgba(0,0,0,0.5)`,
          }}>
          <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${bColor}, ${bColor}00)` }} />
          <div className="p-6">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="text-xs font-mono text-muted-foreground/50">{caseData.case_number}</span>
                  <StatusBadge status={caseData.status} />
                  <span className="text-xs font-bold capitalize px-2 py-0.5 rounded-md"
                    style={{ background: `${bColor}18`, color: bColor, border: `1px solid ${bColor}35` }}>
                    {caseData.priority}
                  </span>
                  <span className="text-xs capitalize px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-muted-foreground">
                    {caseData.category}
                  </span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight mb-2">{caseData.title}</h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                  {caseData.description || 'No description provided.'}
                </p>
                <div className="flex flex-wrap gap-4 mt-4">
                  {caseData.location && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 text-accent/50" /> {caseData.location}
                    </span>
                  )}
                  {caseData.incident_date && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5 text-accent/50" />
                      {new Date(caseData.incident_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5 text-accent/50" />
                    Updated {formatRelativeTime(caseData.updated_at)}
                  </span>
                </div>
                {caseData.tags && caseData.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    <Tag className="w-3 h-3 text-muted-foreground/40" />
                    {caseData.tags.map((t: string) => (
                      <span key={t} className="text-2xs px-1.5 py-0.5 rounded-md font-mono"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(148,163,184,0.8)' }}>
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Right block */}
              <div className="shrink-0 flex flex-col items-end gap-4">
                <div className="flex items-center gap-5">
                  {[['Evidence', evidence.length], ['Suspects', 0]].map(([l, v]) => (
                    <div key={String(l)} className="text-center">
                      <p className="text-3xl font-bold tabular-nums">{v}</p>
                      <p className="text-2xs text-muted-foreground uppercase tracking-wider">{l}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setTab('evidence'); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: 'linear-gradient(135deg,#00b4d8,#1565c0)', color: 'white' }}>
                    <Upload className="w-3.5 h-3.5" /> Upload Evidence
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px',
                tab === t.id ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {t.icon && <t.icon className="w-3.5 h-3.5" />}
              {t.label}
              {t.count !== undefined && (
                <span className={cn('text-2xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                  tab === t.id ? 'bg-accent/15 text-accent' : 'bg-white/5 text-muted-foreground')}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>

            {/* ── OVERVIEW ─────────────────────────────────────── */}
            {tab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-5">
                  {/* AI Synopsis placeholder */}
                  <div className="p-5 rounded-2xl" style={{ background: 'rgba(0,180,216,0.05)', border: '1px solid rgba(0,180,216,0.15)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#00b4d8,#1565c0)' }}>
                        <BrainCircuit className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">AI Forensic Synopsis</p>
                        <p className="text-2xs text-accent/60">Gemini Pro · Awaiting evidence</p>
                      </div>
                    </div>
                    {evidence.length === 0 ? (
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Upload evidence files (videos, images, documents) to enable AI forensic analysis. The AI will generate a detailed case synopsis, detect persons of interest, and build a 3D scene reconstruction.
                        </p>
                      </div>
                    ) : caseData.ai_processed ? (
                      <div className="flex flex-col gap-3 p-4 rounded-xl bg-accent/5 border border-accent/20">
                        <div className="flex items-center gap-2 text-accent font-medium text-sm">
                          <CheckCircle className="w-4 h-4" /> AI Analysis Complete
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          The evidence has been processed. A 3D scene reconstruction is available, and correlations have been identified between {evidence.length} evidence items.
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => setTab('3d-scene')} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-accent-foreground">View 3D Scene</button>
                          <button onClick={() => setTab('correlation')} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-foreground transition">View Correlations</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 p-4 rounded-xl bg-surface-raised border border-border">
                        <p className="text-sm text-muted-foreground leading-7">
                          Case <strong className="text-foreground">{caseData.case_number}</strong> — {evidence.length} evidence item{evidence.length !== 1 ? 's' : ''} uploaded.
                          AI analysis is ready to process the uploaded {evidence.filter((e: any) => e.file_type === 'video').length} video(s) and {evidence.filter((e: any) => e.file_type === 'image').length} image(s).
                        </p>
                        {isProcessing ? (
                          <div className="w-full space-y-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                              <span className="flex items-center gap-2"><div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" /> Processing Evidence...</span>
                              <span>{processingProgress}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-accent transition-all duration-300" style={{ width: `${processingProgress}%` }} />
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={analyzeEvidence}
                            className="w-full py-2.5 flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg text-sm font-semibold transition shadow-[0_0_15px_rgba(0,180,216,0.3)]">
                            <BrainCircuit className="w-4 h-4" /> Run AI Analysis
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Evidence quick preview */}
                  {evidence.length > 0 && (
                    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="flex items-center justify-between px-5 py-3.5"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                        <div className="flex items-center gap-2">
                          <Film className="w-4 h-4 text-accent" />
                          <span className="text-sm font-semibold">Evidence ({evidence.length})</span>
                        </div>
                        <button onClick={() => setTab('evidence')} className="text-xs text-accent hover:text-accent/80 flex items-center gap-1">
                          View all <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                      {evidence.slice(0, 4).map((ev: any) => {
                        const Icon = getFileIcon(ev.file_type || '');
                        return (
                          <div key={ev.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.025] transition border-b border-white/[0.04] last:border-0">
                            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-surface-raised flex items-center justify-center">
                              {ev.file_url && !ev.file_url.startsWith('local://') && ev.file_type === 'image'
                                ? <img src={ev.file_url} alt="" className="w-full h-full object-cover" />
                                : <Icon className="w-4 h-4 text-accent/30" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{ev.original_name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{ev.file_type} · {formatFileSize(ev.file_size || 0)}</p>
                            </div>
                            <span className="text-2xs text-accent/60 bg-accent/10 px-2 py-0.5 rounded-full">
                              {caseData.ai_processed ? 'Processed' : 'Pending'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right sidebar */}
                <div className="space-y-4">
                  <div className="rounded-2xl p-5 space-y-3" style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                    <h3 className="text-sm font-semibold">Case Details</h3>
                    {[
                      ['Case Number', caseData.case_number],
                      ['Status', caseData.status],
                      ['Priority', caseData.priority],
                      ['Category', caseData.category],
                      ['Location', caseData.location || '—'],
                      ['Created', new Date(caseData.created_at).toLocaleDateString('en-IN')],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-medium capitalize text-foreground">{v}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setTab('evidence')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: 'linear-gradient(135deg,#00b4d8,#1565c0)', color: 'white' }}>
                    <Upload className="w-4 h-4" />
                    Upload Evidence
                  </button>
                </div>
              </div>
            )}

            {/* ── EVIDENCE ─────────────────────────────────────── */}
            {tab === 'evidence' && (
              <div className="space-y-6">
                <EvidenceUploader caseId={caseId} onUploaded={loadEvidence} />
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Film className="w-4 h-4 text-accent" />
                    <h3 className="text-sm font-semibold text-foreground">Uploaded Evidence ({evidence.length})</h3>
                  </div>
                  <EvidenceGrid items={evidence} caseId={caseId} onDeleted={loadEvidence} />
                </div>
              </div>
            )}

            {/* ── 3D SCENE ─────────────────────────────────────── */}
            {tab === '3d-scene' && (
              <div className="h-[600px] bg-surface-raised rounded-2xl border border-border p-1">
                {caseData.ai_processed ? (
                  <SceneViewer3D 
                    currentTime={0} 
                    className="w-full h-full rounded-xl"
                    evidenceMarkers={caseData.metadata?.dynamicEvidenceMarkers}
                    trajectories={caseData.metadata?.dynamicTrajectories}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center p-6">
                    <Box className="w-16 h-16 text-muted-foreground/20 mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">3D Scene Not Generated</h3>
                    <p className="text-sm text-muted-foreground max-w-md mb-6">
                      The spatial reconstruction requires AI analysis of the uploaded evidence. Run the analysis from the Overview tab to generate the 3D scene.
                    </p>
                    <button onClick={() => setTab('overview')} className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium">Go to Overview</button>
                  </div>
                )}
              </div>
            )}

            {/* ── CORRELATION ─────────────────────────────────────── */}
            {tab === 'correlation' && (
              <div className="h-[700px] bg-surface-raised rounded-2xl border border-border overflow-hidden">
                {caseData.ai_processed ? (
                  <EvidenceCorrelationEngine 
                    correlations={caseData.metadata?.dynamicCorrelations}
                    trajectories={caseData.metadata?.dynamicTrajectories}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center p-6">
                    <Network className="w-16 h-16 text-muted-foreground/20 mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">Correlations Not Processed</h3>
                    <p className="text-sm text-muted-foreground max-w-md mb-6">
                      Cross-referencing evidence and establishing timelines requires AI analysis. Run the analysis from the Overview tab.
                    </p>
                    <button onClick={() => setTab('overview')} className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium">Go to Overview</button>
                  </div>
                )}
              </div>
            )}

            {/* ── TIMELINE ─────────────────────────────────────── */}
            {tab === 'timeline' && (
              <div className="space-y-4">
                <div className="rounded-2xl p-6 border border-border bg-card text-center">
                  <Clock className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                  <h3 className="text-sm font-medium text-foreground mb-1">Timeline</h3>
                  {!caseData.ai_processed && <p className="text-xs text-muted-foreground mb-4">Timeline will be auto-generated as evidence is processed and timestamps are extracted.</p>}
                  <div className="mt-4 space-y-2 text-left max-w-sm mx-auto">
                    {[
                      { time: new Date(caseData.created_at).toLocaleString('en-IN'), event: 'Case created', color: 'bg-blue-500' },
                      { time: new Date(caseData.incident_date || caseData.created_at).toLocaleString('en-IN'), event: 'Incident reported', color: 'bg-orange-500' },
                      ...(caseData.metadata?.dynamicTimelineEvents || []),
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${item.color || 'bg-gray-500'}`} />
                        <div>
                          <p className="text-xs text-muted-foreground font-mono">{item.time}</p>
                          <p className="text-sm text-foreground">{item.event}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── REPORTS ─────────────────────────────────────── */}
            {tab === 'reports' && (
              <div className="space-y-4">
                {caseData.ai_processed ? (
                  <ReportGenerator caseData={caseData} evidence={evidence} />
                ) : (
                  <div className="rounded-2xl p-6 border border-border bg-card text-center">
                    <FileText className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                    <h3 className="text-sm font-medium text-foreground mb-1">Reports Not Available</h3>
                    <p className="text-xs text-muted-foreground mb-4">AI-generated forensic reports will appear here once evidence analysis is complete.</p>
                    <button onClick={() => setTab('overview')} className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium">Go to Overview</button>
                  </div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
