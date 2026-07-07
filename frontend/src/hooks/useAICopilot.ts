import { useState, useCallback } from 'react'
import { toast } from 'sonner'

export interface CopilotResponse {
  query: string
  response: string
  model: string
  tokens_used: number
  success: boolean
}

export interface ImageAnalysisResult {
  success: boolean
  analysis_type: string
  analysis: string
  model: string
  tokens_used: number
}

export interface EvidenceInvestigation {
  success: boolean
  analysis: Record<string, any>
  model: string
  tokens_used: number
}

/**
 * Hook for AI Copilot functionality
 */
export function useAICopilot() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const copilotQuery = useCallback(
    async (query: string, caseContext?: Record<string, any>): Promise<CopilotResponse | null> => {
      setLoading(true)
      setError(null)

      try {
        const formData = new FormData()
        formData.append('query', query)
        if (caseContext) {
          formData.append('case_context', JSON.stringify(caseContext))
        }

        const response = await fetch('/api/copilot/copilot-query', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`)
        }

        const data: CopilotResponse = await response.json()

        if (!data.success) {
          throw new Error(data.response || 'Unknown error')
        }

        toast.success('Analysis complete')
        return data
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to process query'
        setError(errorMsg)
        toast.error(errorMsg)
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const analyzeImage = useCallback(
    async (
      file: File,
      analysisType: 'forensic' | 'suspect' | 'weapon' | 'scene' | 'evidence' = 'forensic',
      context?: string
    ): Promise<ImageAnalysisResult | null> => {
      setLoading(true)
      setError(null)

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('analysis_type', analysisType)
        if (context) {
          formData.append('context', context)
        }

        const response = await fetch('/api/copilot/analyze-image', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`)
        }

        const data: ImageAnalysisResult = await response.json()

        if (!data.success) {
          throw new Error(data.analysis || 'Unknown error')
        }

        toast.success('Image analysis complete')
        return data
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to analyze image'
        setError(errorMsg)
        toast.error(errorMsg)
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const investigateEvidence = useCallback(
    async (
      description: string,
      detections?: Record<string, any>[]
    ): Promise<EvidenceInvestigation | null> => {
      setLoading(true)
      setError(null)

      try {
        const formData = new FormData()
        formData.append('evidence_description', description)
        if (detections) {
          formData.append('detections', JSON.stringify(detections))
        }

        const response = await fetch('/api/copilot/investigate-evidence', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`)
        }

        const data: EvidenceInvestigation = await response.json()

        if (!data.success) {
          throw new Error('Investigation failed')
        }

        toast.success('Evidence investigation complete')
        return data
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to investigate evidence'
        setError(errorMsg)
        toast.error(errorMsg)
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const generateReport = useCallback(
    async (
      caseSummary: string,
      findings?: string[],
      suspects?: Record<string, any>[]
    ): Promise<Record<string, any> | null> => {
      setLoading(true)
      setError(null)

      try {
        const formData = new FormData()
        formData.append('case_summary', caseSummary)
        if (findings) {
          formData.append('findings', JSON.stringify(findings))
        }
        if (suspects) {
          formData.append('suspects', JSON.stringify(suspects))
        }

        const response = await fetch('/api/copilot/generate-report', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`)
        }

        const data = await response.json()

        if (!data.success) {
          throw new Error('Report generation failed')
        }

        toast.success('Report generated successfully')
        return data
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to generate report'
        setError(errorMsg)
        toast.error(errorMsg)
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return {
    loading,
    error,
    copilotQuery,
    analyzeImage,
    investigateEvidence,
    generateReport,
    clearError: () => setError(null),
  }
}
