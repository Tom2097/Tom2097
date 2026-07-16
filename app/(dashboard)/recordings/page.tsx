"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Mic, Upload, FileAudio, Clock, CheckCircle2, Loader2, Play, User, Calendar, ListChecks, Sparkles } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { useI18n } from "@/components/providers/i18n-provider"
import type { RecordingUpload, TranscriptionResult, ActionItem } from "@/lib/audio/ingestion"

function readAudioDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio")
    audio.preload = "metadata"
    audio.onloadedmetadata = () => {
      resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration) : undefined)
      URL.revokeObjectURL(audio.src)
    }
    audio.onerror = () => resolve(undefined)
    audio.src = URL.createObjectURL(file)
  })
}

const STATUS_BADGES: Record<string, string> = {
  pending: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  uploaded: "bg-gray-500/20 text-gray-500 border-gray-500/30",
  processing: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  ready: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
  failed: "bg-red-500/20 text-red-500 border-red-500/30",
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function RecordingsPage() {
  const { t } = useI18n()
  const [recordings, setRecordings] = useState<RecordingUpload[]>([])
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedRecording, setSelectedRecording] = useState<RecordingUpload | null>(null)
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null)
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [processing, setProcessing] = useState(false)

  const refreshRecordings = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/recordings")
      if (!res.ok) return
      const data = await res.json()
      setRecordings(data.recordings ?? [])
    } catch {
      // Non-fatal -- list just keeps its last known values.
    }
  }, [])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    refreshRecordings()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [refreshRecordings])

  const handleFileSelect = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const createRes = await fetch("/api/v1/recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, type: file.type }),
      })
      if (!createRes.ok) throw new Error("Failed to start upload")
      const { recording, signedUrl } = await createRes.json()

      const putRes = await fetch(signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } })
      if (!putRes.ok) throw new Error("Failed to upload file")

      const durationSeconds = await readAudioDuration(file)
      await fetch(`/api/v1/recordings/${recording.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSeconds }),
      })

      toast.success(t('recordings.page.success.uploaded'))
      await refreshRecordings()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('recordings.page.errors.processFailed'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleViewDetails = async (recording: RecordingUpload) => {
    setSelectedRecording(recording)
    setProcessing(true)
    setDetailDialogOpen(true)
    setTranscription(null)
    setActionItems([])

    try {
      const detailRes = await fetch(`/api/v1/recordings/${recording.id}`)
      if (detailRes.ok) {
        const { recording: fetched } = await detailRes.json()
        setSelectedRecording(fetched)
      }

      const res = await fetch(`/api/v1/recordings/${recording.id}/transcribe`, { method: "POST" })
      if (!res.ok) throw new Error(t('recordings.page.errors.processFailed'))
      const { transcription: result, actionItems: items } = await res.json()
      setTranscription(result)
      setActionItems(items)
      refreshRecordings()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('recordings.page.errors.processFailed'))
    } finally {
      setProcessing(false)
    }
  }

  const handleToggleActionItem = async (itemId: string, current: string) => {
    const next: ActionItem['status'] = current === 'completed' ? 'open' : 'completed'
    setActionItems(prev => prev.map(i => i.id === itemId ? { ...i, status: next } : i))
    const res = await fetch(`/api/v1/recordings/action-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    })
    if (res.ok) {
      toast.success(next === 'completed' ? t('recordings.page.success.actionItemCompleted') : t('recordings.page.success.actionItemReopened'))
    } else {
      setActionItems(prev => prev.map(i => i.id === itemId ? { ...i, status: current as ActionItem['status'] } : i))
      toast.error(t('recordings.page.errors.processFailed'))
    }
  }

  const handleAssigneeChange = async (itemId: string, assignee: string) => {
    setActionItems(prev => prev.map(i => i.id === itemId ? { ...i, assignee } : i))
    await fetch(`/api/v1/recordings/action-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignee }),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-500">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('recordings.page.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('recordings.page.subtitle')}</p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files?.[0])}
        />
        <Button disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          {t('recordings.page.uploadRecording')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('recordings.page.allRecordings')}</CardTitle>
          <CardDescription>{t('recordings.page.recordingCount', { count: recordings.length })}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {recordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <FileAudio className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-sm text-muted-foreground">{t('recordings.page.noRecordings')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('recordings.page.uploadFirst')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('recordings.page.name')}</TableHead>
                  <TableHead>{t('recordings.page.duration')}</TableHead>
                  <TableHead>{t('recordings.page.size')}</TableHead>
                  <TableHead>{t('recordings.page.status')}</TableHead>
                  <TableHead>{t('recordings.page.date')}</TableHead>
                  <TableHead className="text-right">{t('recordings.page.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recordings.map(rec => (
                  <TableRow key={rec.id}>
                    <TableCell className="font-medium">{rec.name}</TableCell>
                    <TableCell className="text-sm">{formatDuration(rec.duration)}</TableCell>
                    <TableCell className="text-sm">{formatSize(rec.size)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_BADGES[rec.status]}>
                        {rec.status === 'processing' || rec.status === 'pending' ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : rec.status === 'ready' ? (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        ) : null}
                        {rec.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{new Date(rec.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleViewDetails(rec)}>
                        <Play className="h-3 w-3 mr-1" /> {t('recordings.page.view')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRecording?.name || t('recordings.page.recordingDetails')}</DialogTitle>
            <DialogDescription>
              {selectedRecording?.duration ? t('recordings.page.durationLabel', { duration: formatDuration(selectedRecording.duration) }) : t('recordings.page.processing')}
            </DialogDescription>
          </DialogHeader>

          {processing ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{t('recordings.page.processingTranscription')}</p>
              <Progress value={65} className="w-64" />
            </div>
          ) : (
            <div className="space-y-6">
              {transcription?.isSimulated && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  {t('recordings.page.simulatedTranscriptNotice')}
                </div>
              )}
              {transcription && (
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {t('recordings.page.segmentsTimeline')}
                    <Badge variant="outline" className="ml-auto text-xs">{t('recordings.page.confidence', { confidence: transcription.confidence })}</Badge>
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {transcription.segments.map((seg, i) => (
                      <div key={i} className="rounded bg-muted/50 px-3 py-2 text-sm">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <span className="font-mono">{formatDuration(seg.start)} - {formatDuration(seg.end)}</span>
                          <span className="font-medium text-foreground">{seg.speaker}</span>
                        </div>
                        <p>{seg.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {transcription && (
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <FileAudio className="h-4 w-4 text-muted-foreground" />
                    {t('recordings.page.fullTranscription')}
                  </h3>
                  <div className="rounded bg-muted/30 p-4 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto font-mono text-xs">
                    {transcription.text}
                  </div>
                </div>
              )}

              <Separator />

              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <ListChecks className="h-4 w-4 text-muted-foreground" />
                  {t('recordings.page.actionItems')}
                </h3>
                {actionItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('recordings.page.noActionItems')}</p>
                ) : (
                  <div className="space-y-2">
                    {actionItems.map(item => (
                      <div key={item.id} className="flex items-start gap-3 rounded bg-muted/50 px-3 py-2">
                        <Checkbox
                          checked={item.status === 'completed'}
                          onCheckedChange={() => handleToggleActionItem(item.id, item.status)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${item.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                            {item.text}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <Badge variant="outline" className={`text-xs ${
                              item.status === 'completed' ? 'text-emerald-500' :
                              item.status === 'in_progress' ? 'text-amber-500' : 'text-gray-500'
                            }`}>
                              {item.status.replace('_', ' ')}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              <input
                                className="bg-transparent border-b border-dashed border-muted-foreground/30 outline-none focus:border-primary w-28"
                                placeholder={t('recordings.page.assignTo')}
                                value={item.assignee || ''}
                                onChange={e => handleAssigneeChange(item.id, e.target.value)}
                              />
                            </div>
                            {item.dueDate && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />{item.dueDate}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>{t('recordings.page.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
