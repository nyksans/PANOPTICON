// ============================================================
// PANOPTICON Core Type Definitions
// ============================================================

// --- Auth ---
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  badge?: string;
  department?: string;
  createdAt: string;
  lastActive: string;
}

export type UserRole = 'admin' | 'investigator' | 'analyst' | 'viewer';

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// --- Case ---
export type CaseStatus = 'active' | 'pending' | 'closed' | 'archived';
export type CasePriority = 'critical' | 'high' | 'medium' | 'low';

export interface Case {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  status: CaseStatus;
  priority: CasePriority;
  category: string;
  location: string;
  incidentDate: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  assignedTo: string[];
  evidenceCount: number;
  suspects: number;
  aiProcessed: boolean;
  confidenceScore: number;
  tags: string[];
}

export interface CreateCasePayload {
  title: string;
  description: string;
  priority: CasePriority;
  category: string;
  location: string;
  incidentDate: string;
}

// --- Evidence ---
export type EvidenceType = 'video' | 'image' | 'bodycam' | 'drone' | 'audio' | 'document';
export type EvidenceStatus = 'uploaded' | 'processing' | 'processed' | 'failed' | 'reviewed';

export interface Evidence {
  id: string;
  caseId: string;
  filename: string;
  originalName: string;
  type: EvidenceType;
  size: number;
  duration?: number;
  resolution?: string;
  fps?: number;
  fileUrl: string;
  thumbnailUrl?: string;
  status: EvidenceStatus;
  uploadedAt: string;
  processedAt?: string;
  uploadedBy: string;
  metadata: EvidenceMetadata;
  aiResults?: AIProcessingResult;
  tags: string[];
  notes: string;
  hash: string;
}

export interface EvidenceMetadata {
  captureDate?: string;
  captureTime?: string;
  cameraId?: string;
  cameraLocation?: string;
  gpsCoordinates?: { lat: number; lng: number };
  deviceInfo?: string;
  codec?: string;
  bitrate?: number;
}

// --- AI Processing ---
export interface AIProcessingResult {
  processingId: string;
  evidenceId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt: string;
  completedAt?: string;
  objects: DetectedObject[];
  persons: DetectedPerson[];
  events: DetectedEvent[];
  synopsis: string;
  confidence: number;
  processingModels: string[];
}

export interface DetectedObject {
  id: string;
  label: string;
  confidence: number;
  bbox: BoundingBox;
  frameNumber: number;
  timestamp: number;
  trackId?: string;
  color?: string;
}

export interface DetectedPerson {
  id: string;
  trackId: string;
  label: string;
  confidence: number;
  firstSeen: number;
  lastSeen: number;
  frames: PersonFrame[];
  attributes: PersonAttributes;
  reidMatches?: ReidMatch[];
  suspectId?: string;
}

export interface PersonFrame {
  frameNumber: number;
  timestamp: number;
  bbox: BoundingBox;
  confidence: number;
}

export interface PersonAttributes {
  gender?: string;
  ageRange?: string;
  clothing?: string[];
  accessories?: string[];
  height?: string;
}

export interface ReidMatch {
  evidenceId: string;
  trackId: string;
  confidence: number;
  timestamp: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedEvent {
  id: string;
  type: string;
  description: string;
  timestamp: number;
  confidence: number;
  involvedPersons: string[];
  involvedObjects: string[];
  significance: 'high' | 'medium' | 'low';
}

// --- Timeline ---
export interface TimelineEvent {
  id: string;
  caseId: string;
  timestamp: string;
  endTimestamp?: string;
  title: string;
  description: string;
  type: TimelineEventType;
  source: string;
  evidenceId?: string;
  suspects?: string[];
  location?: string;
  confidence: number;
  significance: 'critical' | 'high' | 'medium' | 'low';
  verified: boolean;
  notes?: string;
  frameUrl?: string;
}

export type TimelineEventType =
  | 'person_detected'
  | 'object_detected'
  | 'interaction'
  | 'movement'
  | 'vehicle'
  | 'weapon'
  | 'audio_event'
  | 'manual'
  | 'system';

// --- Suspect ---
export interface Suspect {
  id: string;
  caseId: string;
  label: string;
  alias?: string;
  description: string;
  attributes: PersonAttributes;
  trackIds: { evidenceId: string; trackId: string }[];
  firstSeen: string;
  lastSeen: string;
  appearances: number;
  cameras: string[];
  confidenceScore: number;
  thumbnailUrl?: string;
  status: 'identified' | 'unidentified' | 'cleared';
  notes?: string;
}

// --- AI Chat ---
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  evidenceRefs?: string[];
  timelineRefs?: string[];
  suspectRefs?: string[];
  confidence?: number;
  processingTime?: number;
}

export interface ChatSession {
  id: string;
  caseId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

// --- Report ---
export type ReportType = 'incident' | 'timeline' | 'suspect' | 'evidence' | 'comprehensive';
export type ReportStatus = 'draft' | 'generated' | 'reviewed' | 'final';

export interface Report {
  id: string;
  caseId: string;
  type: ReportType;
  title: string;
  status: ReportStatus;
  generatedAt: string;
  generatedBy: string;
  reviewedBy?: string;
  summary: string;
  sections: ReportSection[];
  downloadUrl?: string;
  version: number;
}

export interface ReportSection {
  id: string;
  title: string;
  content: string;
  order: number;
  type: 'text' | 'timeline' | 'evidence_grid' | 'suspect_profile' | 'statistics';
  data?: Record<string, unknown>;
}

// --- Dashboard / Stats ---
export interface DashboardStats {
  activeCases: number;
  totalEvidence: number;
  processingQueue: number;
  alertsToday: number;
  suspectsTracked: number;
  reportsGenerated: number;
  aiAccuracy: number;
  systemHealth: 'operational' | 'degraded' | 'critical';
}

export interface SystemHealth {
  api: ServiceHealth;
  database: ServiceHealth;
  redis: ServiceHealth;
  aiPipeline: ServiceHealth;
  storage: ServiceHealth;
}

export interface ServiceHealth {
  status: 'operational' | 'degraded' | 'down';
  latency?: number;
  message?: string;
}

// --- Notifications / Alerts ---
export interface Alert {
  id: string;
  caseId?: string;
  type: 'suspect_match' | 'processing_complete' | 'new_evidence' | 'system' | 'report_ready';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

// --- API ---
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
    hasMore?: boolean;
  };
}

export interface ApiError {
  message: string;
  code: string;
  details?: Record<string, string[]>;
  statusCode: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// --- UI State ---
export type PanelLayout = 'default' | 'split' | 'fullscreen' | 'cinema';

export interface UIState {
  sidebarCollapsed: boolean;
  activePanelLayout: PanelLayout;
  selectedCaseId: string | null;
  selectedEvidenceId: string | null;
  globalSearchOpen: boolean;
  aiPanelOpen: boolean;
  notifications: Alert[];
  unreadCount: number;
}

// --- Indian Case Extensions ---
export interface VictimInfo {
  name: string;
  age: number;
  gender: string;
  occupation: string;
  address: string;
  injuries?: string;
  status: 'alive' | 'deceased' | 'critical' | 'missing';
}

export interface SuspectProfile {
  id: string;
  name: string;
  alias?: string;
  age: number;
  gender: string;
  description: string;
  distinguishingMarks?: string;
  lastKnownLocation?: string;
  vehicleInfo?: string;
  status: 'identified' | 'unidentified' | 'arrested' | 'absconding' | 'cleared';
  confidence: number;
}

export interface CCTVCamera {
  id: string;
  label: string;
  location: string;
  type: 'fixed' | 'ptz' | 'dome' | 'bodycam' | 'drone' | 'dashcam' | 'mobile';
  resolution: string;
  status: 'active' | 'offline' | 'recovered';
  coverageArea: string;
  footageAvailable: boolean;
  timestampRange?: { start: string; end: string };
}

export interface EvidenceGalleryItem {
  id: string;
  type: 'cctv_frame' | 'bodycam_still' | 'drone_aerial' | 'mobile_capture' | 'forensic_photo' | 'document_scan';
  caption: string;
  timestamp: string;
  cameraId?: string;
  thumbnailUrl: string;
}

export interface InvestigationNote {
  id: string;
  author: string;
  rank: string;
  timestamp: string;
  content: string;
  category: 'observation' | 'forensic' | 'witness' | 'ai_insight' | 'command';
}

export interface CustodyEntry {
  timestamp: string;
  action: string;
  officer: string;
  rank: string;
  location: string;
  hash?: string;
}

export interface IndianCaseMetadata {
  firNumber: string;
  policeStation: string;
  district: string;
  state: string;
  ipcSections: string[];
  leadIO: string;
  ioRank: string;
  ioPhone: string;
  victims: VictimInfo[];
  suspectProfiles: SuspectProfile[];
  cctvCameras: CCTVCamera[];
  evidenceGallery: EvidenceGalleryItem[];
  investigationNotes: InvestigationNote[];
  pendingTasks: string[];
  chainOfCustody: CustodyEntry[];
  investigationProgress: number;
  gpsCenter: { lat: number; lng: number };
}

export interface IndianCase extends Case {
  metadata: IndianCaseMetadata;
  timeline: IndianTimelineEntry[];
  aiSummary: string;
}

export interface IndianTimelineEntry {
  id: string;
  time: string;
  event: string;
  significance: 'critical' | 'high' | 'medium' | 'low';
  cameraId?: string;
  personIds?: string[];
  objectIds?: string[];
}
