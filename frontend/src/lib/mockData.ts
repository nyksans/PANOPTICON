import type { Case, Evidence, Suspect, TimelineEvent, DashboardStats, Alert, ChatMessage, Report, IndianCase } from '@/types';
import { indianCases } from './indianCases';

// Export the indian cases directly if needed
export { indianCases };

// Map indianCases to mockCases (basic Case type)
export const mockCases: Case[] = indianCases.map(c => ({
  id: c.id,
  caseNumber: c.caseNumber,
  title: c.title,
  description: c.description,
  status: c.status as any,
  priority: c.priority,
  category: c.category,
  location: c.location,
  incidentDate: c.incidentDate,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
  createdBy: c.createdBy,
  assignedTo: c.assignedTo,
  evidenceCount: c.evidenceCount,
  suspects: c.suspects,
  aiProcessed: c.aiProcessed,
  confidenceScore: c.confidenceScore,
  tags: c.tags,
}));

// Map Indian case evidence gallery and CCTV cameras to generic Evidence
export const mockEvidence: Evidence[] = indianCases.flatMap(c => {
  const evidences: Evidence[] = [];
  
  if (c.metadata?.evidenceGallery) {
    c.metadata.evidenceGallery.forEach(eg => {
      evidences.push({
        id: eg.id,
        caseId: c.id,
        filename: eg.caption,
        originalName: eg.caption,
        type: eg.type === 'cctv_frame' ? 'video' : eg.type === 'document_scan' ? 'document' : 'image',
        size: 0,
        fileUrl: eg.thumbnailUrl,
        description: eg.caption,
        url: eg.thumbnailUrl,
        thumbnailUrl: eg.thumbnailUrl,
        status: 'processed',
        tags: [eg.type, 'forensic'],
        uploadedBy: c.createdBy,
        uploadedAt: eg.timestamp,
        hash: c.metadata.chainOfCustody?.[0]?.hash || 'unknown',
        notes: eg.caption,
        metadata: {
          cameraLocation: c.location,
          deviceInfo: eg.cameraId || 'unknown',
          resolution: '1080p',
        }
      } as any);
    });
  }

  return evidences;
});

// Map Indian case timeline to TimelineEvent
export const mockTimeline: TimelineEvent[] = indianCases.flatMap(c => {
  if (!c.timeline) return [];
  
  return c.timeline.map((t, idx) => {
    // Generate a full ISO string using the case's incidentDate base
    const baseDate = new Date(c.incidentDate).toISOString().split('T')[0];
    const timestamp = `${baseDate}T${t.time}:00Z`;
    
    return {
      id: t.id || `tl-${c.id}-${idx}`,
      caseId: c.id,
      title: t.event,
      description: t.event,
      timestamp,
      type: t.cameraId ? 'evidence_logged' : 'status_change',
      source: 'system',
      confidence: 1.0,
      significance: 'medium',
      verified: true,
      metadata: {
        location: c.location,
        evidenceIds: t.cameraId ? [t.cameraId] : []
      }
    } as any;
  });
});

// Map suspects to generic Suspect
export const mockSuspects: Suspect[] = indianCases.flatMap(c => {
  if (!c.metadata?.suspectProfiles) return [];
  
  return c.metadata.suspectProfiles.map(s => ({
    id: s.id,
    caseId: c.id,
    name: s.name,
    label: s.name,
    description: s.description,
    trackIds: [],
    cameras: [],
    appearances: 1,
    firstSeen: c.incidentDate,
    lastSeen: c.incidentDate,
    alias: s.alias,
    status: s.status === 'unidentified' ? 'unknown' : s.status === 'arrested' ? 'arrested' : s.status === 'identified' ? 'identified' : 'unknown',
    riskLevel: s.confidence > 0.8 ? 'high' : s.confidence > 0.5 ? 'medium' : 'low',
    attributes: {
      ageRange: s.age ? `${s.age}-${s.age+5}` : undefined,
      gender: s.gender,
      height: s.description.includes('cm') || s.description.includes("'") ? s.description.split(',')[0] : undefined,
      build: undefined,
      hair: undefined,
      eyes: undefined,
      clothing: [],
      accessories: [],
      distinguishingFeatures: [s.distinguishingMarks || ''].filter(Boolean)
    },
    knownAssociates: [],
    linkedCases: [c.id],
    lastKnownLocation: s.lastKnownLocation || c.location,
    notes: s.description,
    confidence: s.confidence * 100,
    imageUrl: `https://picsum.photos/seed/${s.id}/400/400`
  } as any));
});

export const mockAlerts: Alert[] = [
  { id: 'al-001', type: 'system', severity: 'info', title: 'New Case Assigned', message: 'Case PAN-IND-2026-0001 assigned to you', createdAt: '10m ago', read: false },
  { id: 'al-002', type: 'processing_complete', severity: 'info', title: 'AI Processing Complete', message: 'CCTV analysis finished for PAN-IND-2026-0002', createdAt: '1h ago', read: false },
  { id: 'al-003', type: 'new_evidence', severity: 'warning', title: 'Evidence Hash Mismatch', message: 'Chain of custody verification failed for item EG-003-1', createdAt: '2h ago', read: true },
];

export const mockChatMessages: ChatMessage[] = [
  { id: 'msg-1', role: 'assistant', content: 'Hello! I am PANOPTICON Copilot. I can help you analyze cases, cross-reference evidence, and suggest investigation strategies. How can I assist you today?', timestamp: new Date().toISOString() },
];

export const mockReport: Report = {
  id: 'rep-001',
  title: 'Quarterly Crime Trend Analysis',
  type: 'tactical',
  author: 'System',
  createdAt: new Date().toISOString(),
  status: 'draft',
  content: '# Quarterly Crime Trend Analysis\n\nThis report summarizes the crime trends...',
  tags: ['quarterly', 'trends'],
  caseReferences: ['ind-case-001', 'ind-case-002']
} as any;

export const mockStats: DashboardStats = {
  activeCases: indianCases.filter(c => c.status === 'active').length,
  aiProcessingQueue: 12,
  evidenceItems: mockEvidence.length,
  recentActivity: [
    { id: 'act-1', type: 'case_update', description: 'Updated status for PAN-IND-2026-0001', timestamp: '5m ago' },
    { id: 'act-2', type: 'evidence_added', description: 'New CCTV footage uploaded', timestamp: '15m ago' },
  ]
} as any;
