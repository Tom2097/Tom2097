"use client"

import { useState } from "react"
import { Mic, Upload, FileAudio, Clock, CheckCircle2, Loader2, Play, User, Calendar, ListChecks } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import {
  uploadRecording,
  processTranscription,
  extractActionItems,
  getRecording,
  listRecordings,
  updateActionItemStatus,
  updateActionItemAssignee,
  type RecordingUpload,
  type TranscriptionResult,
  type ActionItem,
} from "@/lib/audio/ingestion"

const STATUS_BADGES: Record<string, string> = {
  uploading: "bg-blue-500/20 text-blue-500 border-blue-500/30",
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
  const [recordings, setRecordings] = useState<RecordingUpload[]>(() => listRecordings('default'))
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)

  const [uploadName, setUploadName] = useState("")
  const [uploadSize, setUploadSize] = useState("")
  const [uploadType, setUploadType] = useState("audio/mp3")

  const [selectedRecording, setSelectedRecording] = useState<RecordingUpload | null>(null)
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null)
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [processing, setProcessing] = useState(false)

  const refreshRecordings = () => {
    setRecordings(listRecordings('default'))
  }

  const handleUpload = () => {
    if (!uploadName.trim() || !uploadSize.trim()) {
      toast.error("Name and size are required")
      return
    }
    const recording = uploadRecording('default', { name: uploadName.trim(), size: Number(uploadSize), type: uploadType })
    setRecordings(prev => [recording, ...prev])
    setUploadDialogOpen(false)
    setUploadName("")
    setUploadSize("")
    toast.success("Recording uploaded")

    setTimeout(refreshRecordings, 600)
  }

  const handleViewDetails = (recording: RecordingUpload) => {
    setSelectedRecording(recording)
    setProcessing(true)
    setDetailDialogOpen(true)
    setTranscription(null)
    setActionItems([])

    const fetched = getRecording(recording.id)
    if (fetched) setSelectedRecording(fetched)

    setTimeout(() => {
      try {
        const result = processTranscription(recording.id)
        const items = extractActionItems(recording.id)
        setTranscription(result)
        setActionItems(items)
        setProcessing(false)
        refreshRecordings()
      } catch {
        setProcessing(false)
        toast.error("Failed to process transcription")
      }
    }, 800)
  }

  const handleToggleActionItem = (itemId: string, current: string) => {
    const next: ActionItem['status'] = current === 'completed' ? 'open' : 'completed'
    updateActionItemStatus(itemId, next)
    setActionItems(prev => prev.map(i => i.id === itemId ? { ...i, status: next } : i))
    toast.success(`Action item ${next === 'completed' ? 'completed' : 'reopened'}`)
  }

  const handleAssigneeChange = (itemId: string, assignee: string) => {
    updateActionItemAssignee(itemId, assignee)
    setActionItems(prev => prev.map(i => i.id === itemId ? { ...i, assignee } : i))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-500">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Audio Recordings</h1>
            <p className="text-sm text-muted-foreground">Upload, transcribe, and extract action items from recordings</p>
          </div>
        </div>
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Upload Recording
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Recording</DialogTitle>
              <DialogDescription>Provide file metadata for processing</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>File Name</Label>
                <Input placeholder="meeting-recording.mp3" value={uploadName} onChange={e => setUploadName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Size (bytes)</Label>
                <Input type="number" placeholder="5242880" value={uploadSize} onChange={e => setUploadSize(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>File Type</Label>
                <Input value={uploadType} onChange={e => setUploadType(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpload}>Upload</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Recordings</CardTitle>
          <CardDescription>{recordings.length} recording(s) in your library</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {recordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <FileAudio className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-sm text-muted-foreground">No recordings yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Upload your first recording to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                        {rec.status === 'processing' || rec.status === 'uploading' ? (
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
                        <Play className="h-3 w-3 mr-1" /> View
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
            <DialogTitle>{selectedRecording?.name || 'Recording Details'}</DialogTitle>
            <DialogDescription>
              {selectedRecording?.duration ? `Duration: ${formatDuration(selectedRecording.duration)}` : 'Processing...'}
            </DialogDescription>
          </DialogHeader>

          {processing ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processing transcription...</p>
              <Progress value={65} className="w-64" />
            </div>
          ) : (
            <div className="space-y-6">
              {transcription && (
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Segments Timeline
                    <Badge variant="outline" className="ml-auto text-xs">{transcription.confidence}% confidence</Badge>
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
                    Full Transcription
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
                  Action Items
                </h3>
                {actionItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No action items extracted.</p>
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
                                placeholder="Assign to..."
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
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
