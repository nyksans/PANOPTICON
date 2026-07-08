'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Upload, FileVideo, Image as ImageIcon, Trash2, Eye,
  Download, Zap, CheckCircle, AlertCircle, Clock
} from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { useParams } from 'next/navigation'

interface Evidence {
  id: string
  case_id: string
  title: string
  type: 'video' | 'image' | 'document' | 'audio'
  url: string
  size: number
  created_at: string
  analysis_results: any
  status?: 'uploaded' | 'analyzing' | 'completed' | 'failed'
}

const evidenceTypeIcons = {
  video: FileVideo,
  image: ImageIcon,
  document: FileVideo,
  audio: FileVideo,
}

const evidenceTypeColors = {
  video: 'text-red-600',
  image: 'text-green-600',
  document: 'text-blue-600',
  audio: 'text-purple-600',
}

export default function EvidencePage() {
  const params = useParams()
  const caseId = params.id as string
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        // Determine file type
        let fileType: Evidence['type'] = 'document'
        if (file.type.startsWith('video')) fileType = 'video'
        else if (file.type.startsWith('image')) fileType = 'image'
        else if (file.type.startsWith('audio')) fileType = 'audio'

        // Create evidence record
        const newEvidence: Evidence = {
          id: Math.random().toString(36).substr(2, 9),
          case_id: caseId,
          title: file.name,
          type: fileType,
          url: URL.createObjectURL(file),
          size: file.size,
          created_at: new Date().toISOString(),
          analysis_results: {},
          status: 'uploaded',
        }

        setEvidence(prev => [newEvidence, ...prev])
        toast.success(`Uploaded: ${file.name}`)
      }
    } catch (error) {
      toast.error('Failed to upload evidence')
    } finally {
      setUploading(false)
    }
  }

  const handleAnalyze = async (evidenceId: string) => {
    const item = evidence.find(e => e.id === evidenceId)
    if (!item) return

    try {
      // Update status to analyzing
      setEvidence(prev => prev.map(e =>
        e.id === evidenceId ? { ...e, status: 'analyzing' } : e
      ))

      // Simulate AI analysis
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Mock analysis results
      const results = {
        detections: [
          { type: 'person', confidence: 0.92, count: 2 },
          { type: 'vehicle', confidence: 0.87, count: 1 },
          { type: 'facial_features', confidence: 0.78 },
        ],
        timestamp: new Date().toISOString(),
        processing_time: '2.4s',
      }

      setEvidence(prev => prev.map(e =>
        e.id === evidenceId
          ? { ...e, status: 'completed', analysis_results: results }
          : e
      ))

      toast.success('Analysis completed')
    } catch (error) {
      setEvidence(prev => prev.map(e =>
        e.id === evidenceId ? { ...e, status: 'failed' } : e
      ))
      toast.error('Analysis failed')
    }
  }

  const handleDelete = (evidenceId: string) => {
    setEvidence(prev => prev.filter(e => e.id !== evidenceId))
    toast.success('Evidence deleted')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <DashboardHeader
        title="Evidence"
        subtitle={`${evidence.length} items for this case`}
      />

      <main className="p-6">
        {/* Upload Section */}
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-6"
        >
          <label className="block cursor-pointer">
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-8 text-center hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition">
              <Upload className="w-8 h-8 mx-auto mb-3 text-slate-400" />
              <p className="font-semibold text-slate-900 dark:text-white mb-1">
                Drag evidence here or click to browse
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Supported: Video, Images, Documents, Audio
              </p>
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </div>
          </label>
        </motion.div>

        {/* Evidence Grid */}
        <div className="grid gap-4">
          {evidence.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 rounded-lg border border-slate-200 dark:border-slate-800"
            >
              <p className="text-slate-600 dark:text-slate-400">No evidence uploaded yet</p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            >
              {evidence.map((item, idx) => {
                const IconComponent = evidenceTypeIcons[item.type]
                const getStatusColor = (status?: string) => {
                  switch (status) {
                    case 'analyzing':
                      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                    case 'completed':
                      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    case 'failed':
                      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    default:
                      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                  }
                }

                const getStatusIcon = (status?: string) => {
                  switch (status) {
                    case 'analyzing':
                      return <Clock className="w-4 h-4 animate-spin" />
                    case 'completed':
                      return <CheckCircle className="w-4 h-4" />
                    case 'failed':
                      return <AlertCircle className="w-4 h-4" />
                    default:
                      return null
                  }
                }

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ y: -4 }}
                  >
                    <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
                      {/* Thumbnail */}
                      <div className="relative h-40 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center overflow-hidden">
                        {item.type === 'video' && (
                          <video
                            src={item.url}
                            className="w-full h-full object-cover"
                            onMouseEnter={(e) => e.currentTarget.play()}
                            onMouseLeave={(e) => e.currentTarget.pause()}
                          />
                        )}
                        {item.type === 'image' && (
                          <img
                            src={item.url}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        )}
                        {(item.type === 'document' || item.type === 'audio') && (
                          <IconComponent className={`w-12 h-12 ${evidenceTypeColors[item.type]}`} />
                        )}

                        {/* Status Badge */}
                        <div className={`absolute top-2 right-2 px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(item.status)}`}>
                          {getStatusIcon(item.status)}
                          {item.status || 'uploaded'}
                        </div>
                      </div>

                      <CardContent className="p-4">
                        <p className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-2 mb-2">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                          {(item.size / 1024 / 1024).toFixed(2)} MB • {new Date(item.created_at).toLocaleDateString()}
                        </p>

                        {/* Analysis Results Preview */}
                        {item.analysis_results.detections && (
                          <div className="mb-3 p-2 bg-slate-50 dark:bg-slate-800 rounded text-xs">
                            <p className="font-semibold text-slate-900 dark:text-white mb-1">
                              Detections:
                            </p>
                            <ul className="space-y-1">
                              {item.analysis_results.detections.slice(0, 3).map((det: any, i: number) => (
                                <li key={i} className="text-slate-600 dark:text-slate-400">
                                  {det.type}: {det.confidence.toFixed(2)} ({det.count || '1'})
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          {item.status !== 'analyzing' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => handleAnalyze(item.id)}
                              disabled={(item.status as string) === 'analyzing'}
                            >
                              <Zap className="w-3 h-3 mr-1" />
                              Analyze
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="flex-1"
                            onClick={() => window.open(item.url, '_blank')}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </div>
      </main>
    </div>
  )
}
