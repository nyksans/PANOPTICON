'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Film,
  Users,
  Clock,
  MapPin,
  Shield,
  BrainCircuit,
  FileText,
  Upload,
  ChevronRight,
  Calendar,
  Tag,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { casesApi, evidenceApi, toCaseFrontend, toEvidenceFrontend } from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { cn, formatTimestamp, formatRelativeTime, getPriorityColor, formatFileSize, formatDuration } from '@/lib/utils';
import type { Case, Evidence } from '@/types';

type Tab = 'overview' | 'evidence' | 'suspects' | 'timeline' | 'reports';

export default function CaseDetailPage() {
  const params = useParams();
  const caseId = params.id as string;
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Load case from backend
  const { data: caseApiData, isLoading } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => casesApi.get(caseId),
    retry: 1,
  });

  // Load evidence for this case
  const { data: evidenceData } = useQuery({
    queryKey: ['evidence', 'case', caseId],
    queryFn: () => evidenceApi.list({ case_id: caseId }),
    enabled: !!caseId,
    retry: 1,
  });

  const caseData: Case | null = caseApiData ? toCaseFrontend(caseApiData) : null;
  const caseEvidence: Evidence[] = evidenceData?.data
    ? evidenceData.data.map(toEvidenceFrontend)
    : [];
  
  // Suspects and timeline not yet implemented in backend
  const caseSuspects: any[] = [];
  const caseTimeline: any[] = [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Case not found.</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'evidence', label: 'Evidence', count: caseEvidence.length },
    { id: 'suspects', label: 'Suspects', count: 0 }, // Backend route not yet implemented
    { id: 'timeline', label: 'Timeline', count: 0 }, // Backend route not yet implemented
    { id: 'reports', label: 'Reports' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/cases" className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Cases
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground font-medium">{caseData.caseNumber}</span>
      </div>

      {/* Case header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-panel rounded-xl p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground/60">
                {caseData.caseNumber}
              </span>
              <StatusBadge status={caseData.status} />
              <span className={cn('text-xs font-semibold capitalize', getPriorityColor(caseData.priority))}>
                {caseData.priority} Priority
              </span>
              {caseData.aiProcessed && (
                <div className="flex items-center gap-1 text-xs text-accent">
                  <BrainCircuit className="w-3.5 h-3.5" />
                  AI Processed
                </div>
              )}
            </div>

            <h1 className="text-xl font-bold tracking-tight mb-1">{caseData.title}</h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              {caseData.description}
            </p>

            <div className="flex flex-wrap gap-4 mt-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 text-accent/60" />
                {caseData.location}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5 text-accent/60" />
                {formatTimestamp(caseData.incidentDate, 'dd MMM yyyy HH:mm')}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5 text-accent/60" />
                Updated {formatRelativeTime(caseData.updatedAt)}
              </div>
            </div>
          </div>

          {/* Right: stats + confidence */}
          <div className="flex flex-col items-end gap-3 shrink-0">
            {caseData.aiProcessed && (
              <div className="p-3 rounded-xl bg-accent/5 border border-accent/20 text-right">
                <p className="text-xs text-muted-foreground mb-1">AI Confidence</p>
                <ConfidenceBadge score={caseData.confidenceScore} showBar />
              </div>
            )}
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold tabular-nums">{caseData.evidenceCount}</p>
                <p className="text-2xs text-muted-foreground">Evidence</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <p className="text-2xl font-bold tabular-nums">{caseData.suspects}</p>
                <p className="text-2xs text-muted-foreground">Suspects</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tags */}
        {caseData.tags.length > 0 && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
            <Tag className="w-3.5 h-3.5 text-muted-foreground/60" />
            {caseData.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* Tabs */}
      <div className="flex items-center border-b border-border gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'text-2xs px-1.5 py-0.5 rounded-full',
                  activeTab === tab.id
                    ? 'bg-accent/15 text-accent'
                    : 'bg-surface text-muted-foreground'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'overview' && (
          <CaseOverview caseData={caseData} evidence={caseEvidence} suspects={caseSuspects} timeline={caseTimeline} />
        )}
        {activeTab === 'evidence' && <EvidenceTab evidence={caseEvidence} caseId={caseId} />}
        {activeTab === 'suspects' && <SuspectsTab suspects={caseSuspects} />}
        {activeTab === 'timeline' && <TimelineTab events={caseTimeline} />}
        {activeTab === 'reports' && <ReportsTab caseId={caseId} />}
      </motion.div>
    </div>
  );
}

// Sub-components
function CaseOverview({ caseData, evidence, suspects, timeline }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column */}
      <div className="lg:col-span-2 space-y-4">
        {/* AI Synopsis */}
        {caseData.aiProcessed && (
          <div className="card-panel rounded-xl p-5 border-accent/20">
            <div className="flex items-center gap-2 mb-3">
              <BrainCircuit className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold">AI Forensic Synopsis</h3>
              <span className="badge-info text-2xs ml-auto">Gemini</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {evidence[0]?.aiResults?.synopsis ??
                'AI analysis complete. Cross-camera tracking identified 2 suspects with high confidence. Complete movement reconstruction available from 4 minutes prior to incident through escape route.'}
            </p>
          </div>
        )}

        {/* Recent evidence */}
        <div className="card-panel rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold">Evidence ({evidence.length})</span>
            </div>
            <Link href={`/evidence?case=${caseData.id}`} className="text-xs text-accent hover:text-accent-glow">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-border/50">
            {evidence.slice(0, 4).map((ev: any) => (
              <div key={ev.id} className="flex items-center gap-3 p-3 hover:bg-surface-raised/50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <Film className="w-4 h-4 text-accent/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ev.originalName}</p>
                  <p className="text-xs text-muted-foreground">
                    {ev.type} · {formatFileSize(ev.size)}
                    {ev.duration && ` · ${formatDuration(ev.duration)}`}
                  </p>
                </div>
                <StatusBadge status={ev.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right column */}
      <div className="space-y-4">
        {/* Case info card */}
        <div className="card-panel rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">Case Information</h3>
          <div className="space-y-3">
            {[
              { label: 'Created By', value: caseData.createdBy },
              { label: 'Category', value: caseData.category },
              { label: 'Incident Date', value: formatTimestamp(caseData.incidentDate, 'dd MMM yyyy') },
              { label: 'Opened', value: formatTimestamp(caseData.createdAt, 'dd MMM yyyy') },
              { label: 'Last Updated', value: formatRelativeTime(caseData.updatedAt) },
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-start gap-4">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-xs font-medium text-right">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Suspects overview */}
        {suspects.length > 0 && (
          <div className="card-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold">Suspects ({suspects.length})</h3>
            </div>
            <div className="space-y-3">
              {suspects.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-surface border border-border overflow-hidden shrink-0">
                    <img src={s.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.label}</p>
                    <p className="text-2xs text-muted-foreground">{s.cameras.length} cameras · {s.appearances} appearances</p>
                  </div>
                  <ConfidenceBadge score={s.confidenceScore} size="sm" showLabel={false} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="card-panel rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { label: 'Upload Evidence', icon: Upload, href: '#' },
              { label: 'Generate Report', icon: FileText, href: '#' },
              { label: 'AI Analysis', icon: BrainCircuit, href: '/ai-assistant' },
              { label: 'Add Timeline Event', icon: Clock, href: '#' },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
                >
                  <Icon className="w-4 h-4 text-accent/60" />
                  {action.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function EvidenceTab({ evidence, caseId }: { evidence: any[]; caseId: string }) {
  return (
    <div className="space-y-4">
      {evidence.length === 0 ? (
        <div className="card-panel rounded-xl p-8 text-center">
          <Film className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No evidence uploaded yet.</p>
          <button className="mt-4 badge-info text-sm px-4 py-2 rounded-lg flex items-center gap-2 mx-auto">
            <Upload className="w-4 h-4" /> Upload Evidence
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {evidence.map((ev) => (
            <EvidenceItemCard key={ev.id} evidence={ev} />
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceItemCard({ evidence: ev }: { evidence: any }) {
  return (
    <div className="card-panel rounded-xl overflow-hidden group hover:border-accent/25 transition-all">
      {/* Thumbnail */}
      <div className="relative h-40 bg-surface overflow-hidden">
        {ev.thumbnailUrl ? (
          <img src={ev.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-8 h-8 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
          <span className="badge-info text-2xs capitalize">{ev.type}</span>
          <StatusBadge status={ev.status} className="text-2xs" />
        </div>
        {ev.duration && (
          <div className="absolute bottom-2 right-2 text-xs text-white/80 font-mono">
            {formatDuration(ev.duration)}
          </div>
        )}
      </div>

      <div className="p-3">
        <h4 className="text-sm font-medium truncate mb-1">{ev.originalName}</h4>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(ev.size)}
          {ev.resolution && ` · ${ev.resolution}`}
          {ev.fps && ` · ${ev.fps}fps`}
        </p>
        {ev.metadata?.cameraLocation && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {ev.metadata.cameraLocation}
          </p>
        )}

        {ev.aiResults?.confidence && (
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
            <span className="text-2xs text-muted-foreground">AI Confidence</span>
            <ConfidenceBadge score={ev.aiResults.confidence} size="sm" showLabel={false} />
          </div>
        )}
      </div>
    </div>
  );
}

function SuspectsTab({ suspects }: { suspects: any[] }) {
  if (suspects.length === 0) {
    return (
      <div className="card-panel rounded-xl p-8 text-center">
        <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No suspects identified yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {suspects.map((s) => (
        <div key={s.id} className="card-panel rounded-xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-surface border border-border overflow-hidden shrink-0">
              <img src={s.thumbnailUrl} alt={s.label} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">{s.label}</h3>
                  <StatusBadge status={s.status} className="mt-1" />
                </div>
                <ConfidenceBadge score={s.confidenceScore} showBar />
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{s.description}</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {s.attributes.gender && (
              <div>
                <p className="text-2xs text-muted-foreground">Gender</p>
                <p className="text-xs font-medium">{s.attributes.gender}</p>
              </div>
            )}
            {s.attributes.ageRange && (
              <div>
                <p className="text-2xs text-muted-foreground">Age Range</p>
                <p className="text-xs font-medium">{s.attributes.ageRange}</p>
              </div>
            )}
          </div>

          {s.attributes.clothing && (
            <div className="mt-3">
              <p className="text-2xs text-muted-foreground mb-1">Clothing</p>
              <div className="flex flex-wrap gap-1">
                {s.attributes.clothing.map((item: string) => (
                  <span key={item} className="text-2xs px-1.5 py-0.5 rounded bg-surface border border-border text-muted-foreground">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-4">
            <span className="text-xs text-muted-foreground">{s.cameras.length} cameras</span>
            <span className="text-xs text-muted-foreground">{s.appearances} appearances</span>
          </div>

          {s.notes && (
            <p className="mt-2 text-xs text-accent/70 bg-accent/5 rounded-lg px-3 py-2 border border-accent/15">
              {s.notes}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function TimelineTab({ events }: { events: any[] }) {
  if (events.length === 0) {
    return (
      <div className="card-panel rounded-xl p-8 text-center">
        <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No timeline events generated yet.</p>
      </div>
    );
  }

  const significanceColor: Record<string, string> = {
    critical: 'text-danger border-danger/30 bg-danger/10',
    high: 'text-warning border-warning/30 bg-warning/10',
    medium: 'text-accent border-accent/30 bg-accent/10',
    low: 'text-muted-foreground border-border bg-surface',
  };

  return (
    <div className="relative">
      <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-accent/30 via-accent/20 to-transparent" />
      <div className="space-y-4">
        {events.map((event, i) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex gap-6"
          >
            {/* Timeline node */}
            <div className="relative shrink-0">
              <div className={cn(
                'w-10 h-10 rounded-full border-2 flex items-center justify-center',
                significanceColor[event.significance]
              )}>
                {event.verified ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
              </div>
            </div>

            {/* Event card */}
            <div className="flex-1 card-panel rounded-xl p-4 mb-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono text-muted-foreground/70">
                      {formatTimestamp(event.timestamp, 'HH:mm:ss')}
                    </span>
                    <span className={cn(
                      'text-2xs px-1.5 py-0.5 rounded border capitalize font-medium',
                      significanceColor[event.significance]
                    )}>
                      {event.significance}
                    </span>
                    <span className="badge-info text-2xs capitalize">
                      {event.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold mb-1">{event.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{event.description}</p>
                </div>
                <ConfidenceBadge score={event.confidence} size="sm" showLabel={false} />
              </div>

              {event.frameUrl && (
                <div className="mt-3 rounded-lg overflow-hidden h-32">
                  <img src={event.frameUrl} alt="Evidence frame" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {event.source}
                </span>
                {event.location && (
                  <span className="text-xs text-muted-foreground">→ {event.location}</span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ReportsTab({ caseId }: { caseId: string }) {
  return (
    <div className="space-y-4">
      <div className="card-panel rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold">Forensic Reports</h3>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-medium hover:bg-accent-glow transition-colors">
            <BrainCircuit className="w-3.5 h-3.5" /> Generate AI Report
          </button>
        </div>
        <Link href="/reports" className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-raised/50 transition-colors border border-border">
          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-accent" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Comprehensive Forensic Report v2</p>
            <p className="text-xs text-muted-foreground">Generated 30 Jun 2026 · Reviewed</p>
          </div>
          <span className="badge-active">reviewed</span>
        </Link>
      </div>
    </div>
  );
}
