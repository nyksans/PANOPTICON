import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

// Create axios instance with auth headers
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token')
        window.location.href = '/auth/signin'
      }
    }
    return Promise.reject(error)
  }
)

// Auth endpoints
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
}

import { supabase } from './supabase'

export const casesAPI = {
  list: async (page = 1, page_size = 20, status?: string, priority?: string, search?: string) => {
    let query = supabase.from('cases').select('*').order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    if (priority) query = query.eq('priority', priority)
    if (search) query = query.ilike('title', `%${search}%`)
    const { data, error } = await query
    if (error) throw error
    return { data: { data } }
  },
  get: async (id: string) => {
    const { data, error } = await supabase.from('cases').select('*').eq('id', id).single()
    if (error) throw error
    return { data }
  },
  create: async (data: any) => {
    // Generate a unique case number like CASE-2026-XXXX
    const year = new Date().getFullYear()
    const randomSuffix = Math.floor(1000 + Math.random() * 9000)
    const caseNumber = `CASE-${year}-${randomSuffix}`

    const caseData = {
      case_number: caseNumber,
      title: data.title || 'New Investigation',
      description: data.description || '',
      status: data.status || 'open',
      priority: data.priority || 'medium',
      category: data.category || 'investigation',
      location: data.location || 'Unknown',
      incident_date: data.incident_date || new Date().toISOString(),
      tags: data.tags || [],
      assigned_to: data.assigned_to || [],
      created_by: data.created_by || '',
      ai_processed: false,
      confidence_score: 0,
    }
    const { data: created, error } = await supabase.from('cases').insert([caseData]).select().single()
    if (error) {
      console.error('Supabase case insert error:', error)
      throw error
    }
    return { data: created }
  },
  update: async (id: string, data: any) => {
    const { data: updated, error } = await supabase.from('cases').update(data).eq('id', id).select().single()
    if (error) throw error
    return { data: updated }
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('cases').delete().eq('id', id)
    if (error) throw error
    return { data: { success: true } }
  },
}

// Evidence endpoints
export const evidenceAPI = {
  list: (caseId?: string, fileType?: string, status?: string, page = 1, page_size = 20) =>
    api.get('/evidence', { params: { case_id: caseId, file_type: fileType, status, page, page_size } }),
  get: (id: string) => api.get(`/evidence/${id}`),
  getDetections: (id: string) => api.get(`/evidence/${id}/detections`),
  upload: (caseId: string, file: File, notes?: string, tags?: string) => {
    const formData = new FormData()
    formData.append('case_id', caseId)
    formData.append('file', file)
    if (notes) formData.append('notes', notes)
    if (tags) formData.append('tags', tags)
    return api.post('/evidence/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  process: (id: string) => api.post(`/evidence/${id}/process`),
  delete: (id: string) => api.delete(`/evidence/${id}`),
}

// Dashboard endpoints
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getTimeline: (caseId?: string) => api.get('/dashboard/timeline', { params: { case_id: caseId } }),
}

// AI endpoints
export const aiAPI = {
  copilot: (query: string, caseId?: string, context?: any) =>
    api.post('/ai/copilot', { query, case_id: caseId, context }),
  processEvidence: (evidenceId: string) =>
    api.post(`/evidence/${evidenceId}/process`),
}

export default api
