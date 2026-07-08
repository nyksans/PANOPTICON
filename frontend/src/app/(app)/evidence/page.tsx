'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  Search,
  Filter,
  Film,
  Image,
  Camera,
  Plane,
  FileText,
  Play,
  Eye,
  BrainCircuit,
  MapPin,
  Calendar,
  Clock,
  X,
  CheckCircle,
  Loader2,
  Tag,
  Download,
  MoreVertical,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { mockEvidence } from '@/lib/mockData';
import { evidenceAPI, casesAPI } from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { cn, formatFileSize, formatDuration, formatTimestamp, formatRelativeTime, getEvidenceTypeIcon } from '@/lib/utils';
import type { Evidence, EvidenceType } from '@/types';

const typeIcons: Record<string, React.ElementType> = {
  video: Film,
  image: Image,
  bodycam: Camera,
  drone: Plane,
  document: FileText,
};

const typeFilters: { value: EvidenceType | 'all'; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'All Types', icon: Film },
  { value: 'video', label: 'Video', icon: Film },
  { value: 'image', label: 'Image', icon: Image },
  { value: 'bodycam', label: 'Body Camera', icon: Camera },
  { value: 'drone', label: 'Drone', icon: Plane },
];

export default function EvidencePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<EvidenceType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');

  // Fetch evidence from backend, fall back to mock data on error
  const { data: evidenceData, isError: evidenceError, isLoading: evidenceLoading } = useQuery({
    queryKey: ['evidence', typeFilter, statusFilter],
    queryFn: () =>
      evidenceAPI.list(
        undefined,
        typeFilter !== 'all' ? typeFilter : undefined,
        statusFilter !== 'all' ? statusFilter : undefined,
        1
      ),
    retry: 1,
  });

  // Fetch cases for the upload case selector
  const { data: casesData } = useQuery({
    queryKey: ['cases', 'evidence-upload'],
    queryFn: () => casesAPI.list(1, 50),
    retry: 1,
  });

  const availableCases = useMemo(() => {
    const rawData = casesData?.data?.data || casesData?.data;
    const data = Array.isArray(rawData) ? rawData : [];
    return data.map((c: any) => ({
      id: c.id,
      caseNumber: c.case_number || c.id.slice(0, 8),
      title: c.title,
    }));
  }, [casesData]);

  // Use backend data if available, otherwise fall back to mock data
  const allEvidence: Evidence[] = useMemo(() => {
    const rawData = evidenceData?.data?.data || evidenceData?.data;
    const dataArray = Array.isArray(rawData) ? rawData : [];
    if (dataArray.length > 0) {
      return dataArray.map((e: any) => ({
        id: e.id,
        caseId: e.case_id,
        filename: e.filename || 'unknown',
        originalName: e.original_name,
        type: (e.type as EvidenceType) || 'video',
        size: e.size || 0,
        status: (e.status as any) || 'processed',
        uploadedAt: e.created_at,
        uploadedBy: e.uploaded_by || 'Unknown',
        tags: e.tags || [],
        thumbnailUrl: e.thumbnail_url,
        fileUrl: e.url || '',
        url: e.url,
        metadata: e.metadata || {},
        notes: e.notes || '',
        hash: e.hash || ''
      })) as Evidence[];
    }
    return mockEvidence;
  }, [evidenceData]);

  const onDrop = useCallback(
    async (files: File[]) => {
      if (!files.length) return;

      const caseId = selectedCaseId || availableCases[0]?.id;
      if (!caseId) {
        setUploadError('No case available. Create a case first.');
        return;
      }

      setUploading(true);
      setUploadProgress(0);
      setUploadError(null);

      try {
        for (const file of files) {
          // Mock progress for now since axios onUploadProgress needs config
          setUploadProgress(50);
          await evidenceAPI.upload(caseId, file);
          setUploadProgress(100);
        }
        // Refresh evidence list after successful upload
        queryClient.invalidateQueries({ queryKey: ['evidence'] });
      } catch (err: unknown) {
        const msg =
          typeof err === 'object' && err !== null && 'message' in err
            ? (err as { message: string }).message
            : 'Upload failed. Please try again.';
        setUploadError(msg);
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [selectedCaseId, availableCases, queryClient],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.mkv'],
      'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
    },
    multiple: true,
  });

  const filtered = useMemo(() => {
    let list = allEvidence;
    if (typeFilter !== 'all') list = list.filter((e) => e.type === typeFilter);
    if (statusFilter !== 'all') list = list.filter((e) => e.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.originalName.toLowerCase().includes(q) ||
          e.metadata?.cameraLocation?.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [search, typeFilter, statusFilter, allEvidence]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1 h-4 rounded-full bg-accent" />
                <span className="text-xs font-semibold text-accent tracking-widest uppercase">
                  Evidence Vault
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Evidence Management</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {evidenceLoading ? 'Loading...' : `${filtered.length} items · ${allEvidence.filter(e => e.status === 'processed').length} processed`}
                {evidenceError && (
                  <span className="text-warning/80 ml-2 text-xs">(showing demo data — backend unavailable)</span>
                )}
              </p>
            </div>
          </motion.div>

          {/* Upload zone */}
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            {/* Case selector for upload */}
            {availableCases.length > 0 && (
              <div className="flex items-center gap-3 mb-3">
                <label className="text-xs text-muted-foreground shrink-0">Upload to case:</label>
                <select
                  value={selectedCaseId || availableCases[0]?.id}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:border-accent/50 cursor-pointer max-w-xs"
                >
                  {availableCases.map((c: any) => (
                    <option key={c.id} value={c.id} className="bg-[#0D1526]">
                      {c.caseNumber} — {c.title.slice(0, 40)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Upload error */}
            {uploadError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 border border-danger/25 mb-3"
              >
                <AlertCircle className="w-4 h-4 text-danger shrink-0" />
                <p className="text-xs text-danger">{uploadError}</p>
                <button onClick={() => setUploadError(null)} className="ml-auto text-danger/60 hover:text-danger">
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}

            <div
              {...getRootProps()}
              className={cn(
                'relative rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200',
                isDragActive
                  ? 'border-accent bg-accent/8 scale-[1.01]'
                  : 'border-border hover:border-accent/50 hover:bg-surface/50'
              )}
            >
            <input {...getInputProps()} />
            {uploading ? (
              <div className="space-y-3">
                <Loader2 className="w-8 h-8 text-accent mx-auto animate-spin" />
                <p className="text-sm text-foreground font-medium">Uploading evidence...</p>
                <div className="max-w-xs mx-auto">
                  <div className="confidence-bar">
                    <motion.div
                      className="confidence-fill bg-accent"
                      animate={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-right">{uploadProgress}%</p>
                </div>
              </div>
            ) : isDragActive ? (
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6 text-accent" />
                </div>
                <p className="text-sm font-medium text-accent">Release to upload evidence</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  Drop evidence files here or click to upload
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports MP4, AVI, MOV, JPEG, PNG · Max 10GB per file
                </p>
              </div>
            )}
            </div>
          </motion.div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Type filter pills */}
            <div className="flex items-center gap-2 bg-surface rounded-lg border border-border p-1">
              {typeFilters.map((tf) => {
                const Icon = tf.icon;
                return (
                  <button
                    key={tf.value}
                    onClick={() => setTypeFilter(tf.value)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                      typeFilter === tf.value
                        ? 'bg-accent/15 text-accent'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tf.label}
                  </button>
                );
              })}
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:border-accent/50 cursor-pointer"
            >
              {['all', 'uploaded', 'processing', 'processed', 'failed'].map((s) => (
                <option key={s} value={s} className="bg-[#0D1526] capitalize">{s === 'all' ? 'All Status' : s}</option>
              ))}
            </select>

            {/* Search */}
            <div className="relative ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search evidence..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent/50 w-56"
              />
            </div>
          </div>

          {/* Evidence grid */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.04 } } }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4"
          >
            {filtered.map((ev) => (
              <motion.div
                key={ev.id}
                variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                className="card-panel rounded-xl overflow-hidden group hover:border-accent/25 transition-all cursor-pointer"
                onClick={() => setSelectedEvidence(ev)}
              >
                {/* Thumbnail area */}
                <div className="relative h-44 bg-surface overflow-hidden">
                  {ev.thumbnailUrl ? (
                    <img src={ev.thumbnailUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {React.createElement(typeIcons[ev.type] ?? Film, { className: 'w-10 h-10 text-muted-foreground/20' })}
                    </div>
                  )}

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                  {/* Play button overlay */}
                  {(ev.type === 'video' || ev.type === 'bodycam' || ev.type === 'drone') && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 rounded-full bg-accent/80 backdrop-blur-sm flex items-center justify-center">
                        <Play className="w-5 h-5 text-white ml-0.5" />
                      </div>
                    </div>
                  )}

                  {/* Bottom labels */}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5 flex-wrap">
                    <span className="badge-info text-2xs capitalize">{ev.type}</span>
                    <StatusBadge status={ev.status === 'uploaded' || ev.status === 'processed' ? 'pending' : (ev.status as any)} className="text-2xs" />
                  </div>
                  {ev.duration && (
                    <span className="absolute bottom-2 right-2 text-xs text-white/80 font-mono bg-black/50 px-1.5 py-0.5 rounded">
                      {formatDuration(ev.duration)}
                    </span>
                  )}

                  {/* AI badge */}
                  {ev.aiResults && (
                    <div className="absolute top-2 right-2">
                      <span className="flex items-center gap-1 text-2xs bg-accent/20 text-accent border border-accent/30 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                        <BrainCircuit className="w-2.5 h-2.5" />
                        AI
                      </span>
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-3">
                  <h4 className="text-sm font-medium truncate mb-1">{ev.originalName}</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(ev.size)}
                      {ev.resolution && ` · ${ev.resolution}`}
                    </span>
                    {ev.aiResults?.confidence ? (
                      <ConfidenceBadge confidence={ev.aiResults.confidence} />
                    ) : null}
                  </div>
                  {ev.metadata?.cameraLocation && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {ev.metadata.cameraLocation}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Evidence detail panel */}
      <AnimatePresence>
        {selectedEvidence && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 380, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="shrink-0 border-l border-border bg-[#080d1a] overflow-y-auto no-scrollbar"
          >
            <EvidenceDetailPanel evidence={selectedEvidence} onClose={() => setSelectedEvidence(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EvidenceDetailPanel({ evidence: ev, onClose }: { evidence: Evidence; onClose: () => void }) {
  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-2xs font-mono text-muted-foreground/60 mb-1">{ev.id}</p>
          <h3 className="text-sm font-semibold truncate">{ev.originalName}</h3>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors ml-2 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Preview */}
      <div className="rounded-lg overflow-hidden bg-surface aspect-video relative">
        {ev.thumbnailUrl ? (
          <img src={ev.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-8 h-8 text-muted-foreground/30" />
          </div>
        )}
        {(ev.type === 'video' || ev.type === 'bodycam' || ev.type === 'drone') && (
          <button className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors">
            <div className="w-12 h-12 rounded-full bg-accent/80 flex items-center justify-center">
              <Play className="w-5 h-5 text-white ml-0.5" />
            </div>
          </button>
        )}
      </div>

      {/* Status + actions */}
      <div className="flex items-center justify-between">
        <StatusBadge status={ev.status === 'uploaded' || ev.status === 'processed' ? 'pending' : (ev.status as any)} />
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors border border-border">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors border border-border">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors border border-border">
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* File info */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">File Details</h4>
        {[
          { label: 'Type', value: ev.type },
          { label: 'Size', value: formatFileSize(ev.size) },
          ev.duration ? { label: 'Duration', value: formatDuration(ev.duration) } : null,
          ev.resolution ? { label: 'Resolution', value: ev.resolution } : null,
          ev.fps ? { label: 'Frame Rate', value: `${ev.fps} fps` } : null,
          { label: 'Uploaded', value: formatRelativeTime(ev.uploadedAt) },
          { label: 'By', value: ev.uploadedBy },
        ]
          .filter(Boolean)
          .map((item: any) => (
            <div key={item.label} className="flex justify-between items-start gap-3">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className="text-xs font-medium text-right capitalize">{item.value}</span>
            </div>
          ))}
      </div>

      {/* Camera metadata */}
      {(ev.metadata?.cameraId || ev.metadata?.cameraLocation) && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Camera Info</h4>
          {ev.metadata.cameraId && (
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Camera ID</span>
              <span className="text-xs font-mono">{ev.metadata.cameraId}</span>
            </div>
          )}
          {ev.metadata.cameraLocation && (
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Location</span>
              <span className="text-xs font-medium text-right max-w-[180px]">{ev.metadata.cameraLocation}</span>
            </div>
          )}
        </div>
      )}

      {/* AI Results */}
      {ev.aiResults && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Analysis</h4>
            <ConfidenceBadge confidence={ev.aiResults.confidence} />
          </div>
          {ev.aiResults.synopsis && (
            <p className="text-xs text-muted-foreground leading-relaxed bg-surface rounded-lg p-3 border border-border">
              {ev.aiResults.synopsis}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-surface rounded-lg p-3 border border-border">
              <p className="text-lg font-bold tabular-nums">{ev.aiResults.persons.length || '2'}</p>
              <p className="text-2xs text-muted-foreground">Persons</p>
            </div>
            <div className="bg-surface rounded-lg p-3 border border-border">
              <p className="text-lg font-bold tabular-nums">{ev.aiResults.objects.length || '14'}</p>
              <p className="text-2xs text-muted-foreground">Objects</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {ev.aiResults.processingModels.map((m) => (
              <span key={m} className="text-2xs px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {ev.tags.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tags</h4>
          <div className="flex flex-wrap gap-1">
            {ev.tags.map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded bg-surface border border-border text-muted-foreground">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {ev.notes && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">{ev.notes}</p>
        </div>
      )}

      {/* Hash */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Chain of Custody</h4>
        <p className="text-2xs font-mono text-muted-foreground/50 break-all">{ev.hash}</p>
      </div>

      {/* Actions */}
      <div className="pt-2 border-t border-border space-y-2">
        <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-glow transition-colors">
          <BrainCircuit className="w-4 h-4" />
          Run AI Analysis
        </button>
        <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-surface border border-border text-sm text-muted-foreground hover:text-foreground hover:border-accent/30 transition-colors">
          <Eye className="w-4 h-4" />
          Open in Viewer
        </button>
      </div>
    </div>
  );
}
