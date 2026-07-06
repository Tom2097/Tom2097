import { generateId } from '@/lib/utils/id'

export interface RecordingUpload {
  id: string
  name: string
  size: number
  type: string
  status: 'uploading' | 'uploaded' | 'processing' | 'ready' | 'failed'
  duration?: number
  createdAt: string
}

export interface TranscriptionResult {
  recordingId: string
  text: string
  segments: { start: number; end: number; speaker: string; text: string }[]
  confidence: number
}

export interface ActionItem {
  id: string
  recordingId: string
  text: string
  assignee?: string
  dueDate?: string
  status: 'open' | 'in_progress' | 'completed'
}

const recordings = new Map<string, RecordingUpload>()
const transcriptions = new Map<string, TranscriptionResult>()
const actionItems = new Map<string, ActionItem[]>()

export function uploadRecording(orgId: string, file: { name: string; size: number; type: string }): RecordingUpload {
  const recording: RecordingUpload = {
    id: generateId(),
    name: file.name,
    size: file.size,
    type: file.type,
    status: 'uploading',
    createdAt: new Date().toISOString(),
  }
  recordings.set(recording.id, recording)

  setTimeout(() => {
    const r = recordings.get(recording.id)
    if (r) {
      r.status = 'uploaded'
      r.duration = Math.round(Math.random() * 3600 + 60)
    }
  }, 500)

  return recording
}

export function processTranscription(recordingId: string): TranscriptionResult {
  const recording = recordings.get(recordingId)
  if (!recording) throw new Error('Recording not found')

  recording.status = 'processing'

  const speakers = ['Speaker A', 'Speaker B', 'Speaker C']
  const segments = Array.from({ length: Math.floor(Math.random() * 8 + 3) }, (_, i) => {
    const start = i * Math.round(Math.random() * 30 + 10)
    const end = start + Math.round(Math.random() * 20 + 5)
    return {
      start,
      end,
      speaker: speakers[i % speakers.length],
      text: `Sample transcribed segment ${i + 1} discussing key topics from the meeting.`,
    }
  })

  const result: TranscriptionResult = {
    recordingId,
    text: segments.map(s => `[${s.start}s - ${s.end}s] ${s.speaker}: ${s.text}`).join('\n'),
    segments,
    confidence: Math.round((Math.random() * 20 + 80) * 10) / 10,
  }

  transcriptions.set(recordingId, result)
  recording.status = 'ready'

  return result
}

export function extractActionItems(recordingId: string): ActionItem[] {
  const existing = actionItems.get(recordingId)
  if (existing) return existing

  const items: ActionItem[] = [
    { id: generateId(), recordingId, text: 'Review transcript and identify key decisions', assignee: '', dueDate: '', status: 'open' },
    { id: generateId(), recordingId, text: 'Follow up on action items with stakeholders', assignee: '', dueDate: '', status: 'open' },
    { id: generateId(), recordingId, text: 'Schedule next review meeting', assignee: '', dueDate: '', status: 'in_progress' },
  ]

  actionItems.set(recordingId, items)
  return items
}

export function getRecording(recordingId: string): RecordingUpload | null {
  return recordings.get(recordingId) ?? null
}

export function listRecordings(_orgId: string): RecordingUpload[] {
  return Array.from(recordings.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function getTranscription(recordingId: string): TranscriptionResult | null {
  return transcriptions.get(recordingId) ?? null
}

export function getActionItems(recordingId: string): ActionItem[] {
  return actionItems.get(recordingId) ?? []
}

export function updateActionItemStatus(itemId: string, status: ActionItem['status']): void {
  for (const [, items] of actionItems) {
    const item = items.find(i => i.id === itemId)
    if (item) {
      item.status = status
      return
    }
  }
}

export function updateActionItemAssignee(itemId: string, assignee: string): void {
  for (const [, items] of actionItems) {
    const item = items.find(i => i.id === itemId)
    if (item) {
      item.assignee = assignee
      return
    }
  }
}

export function updateRecordingStatus(recordingId: string, status: RecordingUpload['status']): RecordingUpload | null {
  const recording = recordings.get(recordingId)
  if (!recording) return null
  recording.status = status
  return recording
}

export function deleteRecording(recordingId: string): boolean {
  recordings.delete(recordingId)
  transcriptions.delete(recordingId)
  actionItems.delete(recordingId)
  return true
}
