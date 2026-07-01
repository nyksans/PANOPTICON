import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { useAuthStore } from '@/store/authStore';
import type {
  ApiResponse,
  ApiError,
  Case,
  Evidence,
  ChatMessage,
  DashboardStats,
  Alert,
  CreateCasePayload,
} from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Axios instance with auth interceptor
// ---------------------------------------------------------------------------
class ApiClient {
  private instance: AxiosInstance;

  constructor() {
    this.instance = axios.create({
      baseURL: `${BASE_URL}/api/v1`,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    // Attach JWT from Zustand store (synced to localStorage via persist)
    this.instance.interceptors.request.use(
      (config) => {
        if (typeof window !== 'undefined') {
          const token = useAuthStore.getState().token;
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Only clear the persisted session when the dedicated /auth/me endpoint
    // returns 401 — meaning the token is definitively invalid/expired.
    // We do NOT hard-redirect here; the (app)/layout guard handles navigation.
    this.instance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const requestUrl = error.config?.url ?? '';
        const isAuthMe = requestUrl.includes('/auth/me');

        if (error.response?.status === 401 && isAuthMe && typeof window !== 'undefined') {
          useAuthStore.getState().clearSession();
          // Let React Router / (app)/layout handle the redirect to /auth/login
          // rather than forcing a hard page reload.
        }
        const apiError: ApiError = {
          message:
            (error.response?.data as Record<string, string>)?.detail ||
            error.message ||
            'An unexpected error occurred',
          code: error.code || 'UNKNOWN',
          statusCode: error.response?.status || 500,
        };
        return Promise.reject(apiError);
      },
    );
  }

  // ---------- Generic methods ----------

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.post<T>(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.delete<T>(url, config);
    return response.data;
  }

  async upload<T>(
    url: string,
    formData: FormData,
    onProgress?: (progress: number) => void,
  ): Promise<T> {
    const response = await this.instance.post<T>(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
    return response.data;
  }
}

export const apiClient = new ApiClient();

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    badge?: string;
    department?: string;
  };
}

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<LoginResponse>('/auth/login', { email, password }),

  logout: () => apiClient.post<{ message: string }>('/auth/logout'),

  me: () => apiClient.get<LoginResponse['user']>('/auth/me'),
};

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

export interface CaseListResponse {
  data: CaseApiRecord[];
  total: number;
  page: number;
  page_size: number;
}

/** Raw backend shape (snake_case) */
export interface CaseApiRecord {
  id: string;
  case_number: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  location: string;
  incident_date: string;
  ai_processed: boolean;
  confidence_score: number;
  tags: string[];
  created_by: string;
  assigned_to: string[];
  created_at: string;
  updated_at: string;
  evidence_count: number;
}

/** Map backend snake_case to frontend camelCase */
export function toCaseFrontend(r: CaseApiRecord): Case {
  return {
    id: r.id,
    caseNumber: r.case_number,
    title: r.title,
    description: r.description,
    status: r.status as Case['status'],
    priority: r.priority as Case['priority'],
    category: r.category,
    location: r.location,
    incidentDate: r.incident_date,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    createdBy: r.created_by,
    assignedTo: r.assigned_to,
    evidenceCount: r.evidence_count,
    suspects: 0,
    aiProcessed: r.ai_processed,
    confidenceScore: r.confidence_score,
    tags: r.tags,
  };
}

export const casesApi = {
  list: (params?: { page?: number; page_size?: number; status?: string; priority?: string; search?: string }) =>
    apiClient.get<CaseListResponse>('/cases', { params }),

  get: (id: string) => apiClient.get<CaseApiRecord>(`/cases/${id}`),

  create: (payload: CreateCasePayload) =>
    apiClient.post<CaseApiRecord>('/cases', {
      title: payload.title,
      description: payload.description,
      priority: payload.priority,
      category: payload.category,
      location: payload.location,
      incident_date: payload.incidentDate,
    }),

  update: (id: string, updates: Partial<CreateCasePayload & { status: string }>) =>
    apiClient.patch<CaseApiRecord>(`/cases/${id}`, updates),

  delete: (id: string) => apiClient.delete<void>(`/cases/${id}`),
};

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export interface EvidenceApiRecord {
  id: string;
  case_id: string;
  filename: string;
  original_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  thumbnail_url: string;
  duration?: number;
  resolution?: string;
  fps?: number;
  status: string;
  metadata_: Record<string, unknown>;
  ai_results?: Record<string, unknown> | null;
  tags: string[];
  notes: string;
  file_hash: string;
  uploaded_by: string;
  uploaded_at: string;
  processed_at?: string | null;
}

export interface EvidenceListResponse {
  data: EvidenceApiRecord[];
  total: number;
  page: number;
  page_size: number;
}

export function toEvidenceFrontend(r: EvidenceApiRecord): Evidence {
  return {
    id: r.id,
    caseId: r.case_id,
    filename: r.filename,
    originalName: r.original_name,
    type: r.file_type as Evidence['type'],
    size: r.file_size,
    fileUrl: `${BASE_URL}${r.file_url}`,
    thumbnailUrl: r.thumbnail_url || undefined,
    duration: r.duration,
    resolution: r.resolution,
    fps: r.fps,
    status: r.status as Evidence['status'],
    uploadedAt: r.uploaded_at,
    processedAt: r.processed_at ?? undefined,
    uploadedBy: r.uploaded_by,
    metadata: (r.metadata_ as Evidence['metadata']) || {},
    aiResults: r.ai_results as Evidence['aiResults'] | undefined,
    tags: r.tags,
    notes: r.notes,
    hash: r.file_hash,
  };
}

export const evidenceApi = {
  list: (params?: { case_id?: string; file_type?: string; status?: string; page?: number }) =>
    apiClient.get<EvidenceListResponse>('/evidence', { params }),

  get: (id: string) => apiClient.get<EvidenceApiRecord>(`/evidence/${id}`),

  getDetections: (id: string) => apiClient.get<DetectionResults>(`/evidence/${id}/detections`),

  upload: (
    caseId: string,
    file: File,
    opts?: { notes?: string; tags?: string },
    onProgress?: (pct: number) => void,
  ) => {
    const form = new FormData();
    form.append('case_id', caseId);
    form.append('file', file);
    if (opts?.notes) form.append('notes', opts.notes);
    if (opts?.tags) form.append('tags', opts.tags);
    return apiClient.upload<EvidenceApiRecord>('/evidence/upload', form, onProgress);
  },

  triggerProcessing: (id: string) =>
    apiClient.post<{ message: string; evidence_id: string; job_id: string }>(
      `/evidence/${id}/process`,
    ),

  delete: (id: string) => apiClient.delete<void>(`/evidence/${id}`),
};

// ---------------------------------------------------------------------------
// Detection Results
// ---------------------------------------------------------------------------

export interface DetectionBBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionRecord {
  label: string;
  confidence: number;
  bbox: DetectionBBox;
  frame_number: number;
  timestamp: number;
  track_id?: string;
  scene_position?: [number, number, number];
}

export interface PersonSummary {
  track_id: string;
  label: string;
  confidence: number;
  first_seen: number;
  last_seen: number;
  frame_count: number;
  scene_positions?: [number, number, number][];
}

export interface ObjectSummary {
  label: string;
  count: number;
}

export interface EventRecord {
  type: string;
  description: string;
  timestamp: number;
  confidence: number;
  significance: string;
}

export interface DetectionResults {
  evidence_id: string;
  status: string;
  persons: PersonSummary[];
  objects: ObjectSummary[];
  events: EventRecord[];
  detections: DetectionRecord[];
  synopsis: string;
  confidence: number;
  processing_models: string[];
  total_detections: number;
}

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

export interface AiChatResponse {
  id: string;
  role: string;
  content: string;
  timestamp: string;
  confidence?: number;
  processing_time?: number;
  evidence_refs?: string[];
  suspect_refs?: string[];
}

export interface ProcessingJobStatus {
  job_id: string;
  status: string;
  progress: number;
  current_step?: string;
  started_at: string;
}

export const aiApi = {
  chat: (caseId: string, message: string, sessionId?: string) =>
    apiClient.post<AiChatResponse>('/ai/chat', {
      case_id: caseId,
      message,
      session_id: sessionId,
    }),

  startProcessing: (evidenceId: string) =>
    apiClient.post<{ job_id: string; evidence_id: string; status: string; progress: number; started_at: string }>(
      `/ai/process/${evidenceId}`,
    ),

  getJobStatus: (jobId: string) =>
    apiClient.get<ProcessingJobStatus>(`/ai/process/${jobId}/status`),

  generateReport: (caseId: string, reportType: string = 'comprehensive') =>
    apiClient.post<{ report_id: string; content: string; status: string }>(
      `/ai/report/generate?case_id=${caseId}&report_type=${reportType}`,
    ),
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardStatsResponse {
  data: DashboardStats;
  success: boolean;
}

export interface SystemHealthResponse {
  status: string;
  services: Record<string, { status: string; latency?: number | null; message?: string | null }>;
  version: string;
}

export interface AlertsResponse {
  data: Alert[];
  total: number;
  success: boolean;
}

export const dashboardApi = {
  stats: () => apiClient.get<DashboardStatsResponse>('/dashboard/stats'),
  health: () => apiClient.get<SystemHealthResponse>('/dashboard/health'),
  alerts: () => apiClient.get<AlertsResponse>('/dashboard/alerts'),
};
