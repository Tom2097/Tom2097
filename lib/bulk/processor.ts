import { generateId } from '@/lib/utils/id'

export interface BatchFile {
  name: string
  size: number
  type: string
}

export interface BatchJob {
  id: string
  orgId: string
  files: BatchFile[]
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  createdAt: string
  completedAt?: string
  errorCount: number
}

export interface BatchResult {
  fileName: string
  status: 'success' | 'error'
  extractedData?: Record<string, unknown>
  error?: string
}

const batchJobs = new Map<string, BatchJob>()
const batchResults = new Map<string, BatchResult[]>()

export function processBatch(files: BatchFile[], orgId: string = 'default'): BatchJob {
  const job: BatchJob = {
    id: generateId(),
    orgId,
    files,
    status: 'pending',
    progress: 0,
    createdAt: new Date().toISOString(),
    errorCount: 0,
  }
  batchJobs.set(job.id, job)
  batchResults.set(job.id, [])

  let progress = 0
  const interval = setInterval(() => {
    progress += Math.floor(Math.random() * 15 + 5)
    if (progress >= 100) {
      progress = 100
      clearInterval(interval)
      job.status = 'completed'
      job.progress = 100
      job.completedAt = new Date().toISOString()

      const results: BatchResult[] = files.map(file => {
        const success = Math.random() > 0.15
        if (success) {
          return {
            fileName: file.name,
            status: 'success',
            extractedData: {
              fields: Math.floor(Math.random() * 20 + 5),
              records: Math.floor(Math.random() * 100 + 1),
              type: file.type,
            },
          }
        }
        job.errorCount++
        return {
          fileName: file.name,
          status: 'error',
          error: 'Processing failed: unexpected format',
        }
      })
      batchResults.set(job.id, results)
    }
    job.progress = progress
    job.status = progress < 100 ? 'processing' : 'completed'
  }, 300)

  return job
}

export function getBatchStatus(jobId: string): BatchJob | null {
  return batchJobs.get(jobId) ?? null
}

export function listBatches(orgId: string): BatchJob[] {
  return Array.from(batchJobs.values())
    .filter(j => j.orgId === orgId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function getBatchResults(jobId: string): BatchResult[] {
  return batchResults.get(jobId) ?? []
}
