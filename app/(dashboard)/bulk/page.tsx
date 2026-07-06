"use client"

import { useState, useEffect, useRef } from "react"
import { Upload, File, X, Trash2, CheckCircle2, AlertCircle, Loader2, Layers, Eye, Plus } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import {
  processBatch,
  getBatchStatus,
  getBatchResults,
  listBatches,
  type BatchFile,
  type BatchJob,
  type BatchResult,
} from "@/lib/bulk/processor"

const STATUS_BADGES: Record<string, string> = {
  pending: "bg-gray-500/20 text-gray-500 border-gray-500/30",
  processing: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  completed: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
  failed: "bg-red-500/20 text-red-500 border-red-500/30",
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function BulkPage() {
  const [batches, setBatches] = useState<BatchJob[]>(() => listBatches('default'))
  const [addFileDialogOpen, setAddFileDialogOpen] = useState(false)
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false)
  const [selectedResults, setSelectedResults] = useState<BatchResult[]>([])
  const [selectedJob, setSelectedJob] = useState<BatchJob | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<BatchFile[]>([])
  const [processing, setProcessing] = useState(false)

  const [newFileName, setNewFileName] = useState("")
  const [newFileSize, setNewFileSize] = useState("")
  const [newFileType, setNewFileType] = useState("text/csv")

  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setBatches(prev => prev.map(b => {
        if (b.status === 'pending' || b.status === 'processing') {
          const updated = getBatchStatus(b.id)
          return updated || b
        }
        return b
      }))
    }, 500)
    return () => clearInterval(interval)
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    const newFiles: BatchFile[] = droppedFiles.map(f => ({
      name: f.name,
      size: f.size,
      type: f.type || 'application/octet-stream',
    }))
    setFiles(prev => [...prev, ...newFiles])
    toast.success(`${droppedFiles.length} file(s) added`)
  }

  const handleAddFile = () => {
    if (!newFileName.trim() || !newFileSize.trim()) {
      toast.error("Name and size are required")
      return
    }
    setFiles(prev => [...prev, { name: newFileName.trim(), size: Number(newFileSize), type: newFileType }])
    setNewFileName("")
    setNewFileSize("")
    setAddFileDialogOpen(false)
    toast.success("File added to batch")
  }

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleProcessBatch = () => {
    if (files.length === 0) {
      toast.error("Add at least one file to process")
      return
    }
    setProcessing(true)
    const job = processBatch(files, 'default')
    setBatches(prev => [job, ...prev])
    setFiles([])
    toast.success(`Batch job ${job.id.slice(0, 8)}... started`)
    setProcessing(false)
  }

  const handleViewResults = (job: BatchJob) => {
    const results = getBatchResults(job.id)
    setSelectedJob(job)
    setSelectedResults(results)
    setResultsDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-500">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bulk Processing</h1>
            <p className="text-sm text-muted-foreground">Drag, drop, and process files in batches</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Drop Zone</CardTitle>
          <CardDescription>Drag and drop files or add them manually</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            ref={dropRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Upload className={`h-8 w-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {isDragging ? "Drop files here" : "Drag & drop files here"}
            </p>
            <p className="text-xs text-muted-foreground mb-4">or</p>
            <Dialog open={addFileDialogOpen} onOpenChange={setAddFileDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Files Manually
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add File</DialogTitle>
                  <DialogDescription>Specify file details for batch processing</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>File Name</Label>
                    <Input placeholder="data.csv" value={newFileName} onChange={e => setNewFileName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Size (bytes)</Label>
                    <Input type="number" placeholder="1024" value={newFileSize} onChange={e => setNewFileSize(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>File Type</Label>
                    <Input value={newFileType} onChange={e => setNewFileType(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddFileDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddFile}>Add File</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{files.length} file(s) selected</p>
                <Button variant="ghost" size="sm" onClick={() => setFiles([])}>
                  <Trash2 className="h-3 w-3 mr-1" /> Clear All
                </Button>
              </div>
              {files.map((file, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <File className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
                    <Badge variant="outline" className="text-xs">{file.type}</Badge>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveFile(i)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button className="w-full mt-2" onClick={handleProcessBatch} disabled={processing}>
                {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Process Batch ({files.length} files)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Batch History</CardTitle>
          <CardDescription>{batches.length} batch job(s) processed</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <Layers className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-sm text-muted-foreground">No batch jobs yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Drop files above to start processing.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Errors</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map(job => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">{job.id.slice(0, 8)}...</TableCell>
                    <TableCell>{job.files.length}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_BADGES[job.status]}>
                        {job.status === 'processing' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                        {job.status === 'completed' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : null}
                        {job.status === 'failed' ? <AlertCircle className="h-3 w-3 mr-1" /> : null}
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <Progress value={job.progress} className="w-20" />
                        <span className="text-xs text-muted-foreground">{job.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={job.errorCount > 0 ? 'text-red-500 font-medium' : 'text-muted-foreground'}>
                        {job.errorCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{new Date(job.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewResults(job)}
                        disabled={job.status === 'pending'}
                      >
                        <Eye className="h-3 w-3 mr-1" /> Results
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={resultsDialogOpen} onOpenChange={setResultsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Batch Results — {selectedJob?.id.slice(0, 8)}...</DialogTitle>
            <DialogDescription>
              {selectedJob?.files.length} file(s) | {selectedResults.filter(r => r.status === 'success').length} succeeded, {selectedResults.filter(r => r.status === 'error').length} failed
            </DialogDescription>
          </DialogHeader>
          {selectedResults.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No results available yet.</p>
          ) : (
            <div className="space-y-2">
              {selectedResults.map((result, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <File className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{result.fileName}</span>
                    </div>
                    <Badge variant="outline" className={result.status === 'success'
                      ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
                      : 'bg-red-500/20 text-red-500 border-red-500/30'
                    }>
                      {result.status === 'success'
                        ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Success</>
                        : <><AlertCircle className="h-3 w-3 mr-1" /> Error</>
                      }
                    </Badge>
                  </div>
                  {result.extractedData && (
                    <div className="rounded bg-muted/30 p-2 text-xs space-y-1 font-mono">
                      {Object.entries(result.extractedData).map(([key, val]) => (
                        <div key={key}>
                          <span className="text-muted-foreground">{key}: </span>
                          <span className="text-foreground">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {result.error && (
                    <p className="text-xs text-red-500 mt-1">{result.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResultsDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
