"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Upload, File, X, Trash2, CheckCircle2, AlertCircle, Loader2, Layers, Eye } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { useI18n } from "@/components/providers/i18n-provider"
import type { BatchJob, BatchResult } from "@/lib/bulk/processor"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"
import { InView } from "@/components/motion-primitives/in-view"

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
  const { t } = useI18n()
  const [batches, setBatches] = useState<BatchJob[]>([])
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false)
  const [selectedResults, setSelectedResults] = useState<BatchResult[]>([])
  const [selectedJob, setSelectedJob] = useState<BatchJob | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [processing, setProcessing] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const refreshBatches = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/bulk")
      if (!res.ok) return
      const data = await res.json()
      setBatches(data.batches ?? [])
    } catch {
      // Non-fatal -- list just keeps its last known values.
    }
  }, [])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    refreshBatches()
    /* eslint-enable react-hooks/set-state-in-effect */
    const interval = setInterval(refreshBatches, 3000)
    return () => clearInterval(interval)
  }, [refreshBatches])

  const addFiles = (newFiles: File[]) => {
    if (newFiles.length === 0) return
    setFiles(prev => [...prev, ...newFiles])
    toast.success(t('bulk.page.filesAdded', { count: newFiles.length }))
  }

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
    addFiles(Array.from(e.dataTransfer.files))
  }

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleProcessBatch = async () => {
    if (files.length === 0) {
      toast.error(t('bulk.page.errors.addOneFile'))
      return
    }
    setProcessing(true)
    try {
      const fileList = files
      const createRes = await fetch("/api/v1/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: fileList.map(f => ({ name: f.name, size: f.size, type: f.type || "application/octet-stream" })) }),
      })
      if (!createRes.ok) throw new Error("Failed to start batch")
      const { job, uploads } = await createRes.json()

      const remaining = [...fileList]
      for (const upload of uploads as Array<{ fileId: string; name: string; signedUrl: string }>) {
        const idx = remaining.findIndex(f => f.name === upload.name)
        const file = idx >= 0 ? remaining.splice(idx, 1)[0] : undefined
        if (!file) continue
        await fetch(upload.signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } })
        await fetch(`/api/v1/bulk/${job.id}/files/${upload.fileId}/confirm`, { method: "POST" })
      }

      toast.success(t('bulk.page.success.batchStarted', { jobId: job.id.slice(0, 8) }))
      setFiles([])
      await refreshBatches()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('bulk.page.errors.addOneFile'))
    } finally {
      setProcessing(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleViewResults = async (job: BatchJob) => {
    try {
      const res = await fetch(`/api/v1/bulk/${job.id}`)
      if (!res.ok) throw new Error("Failed to load results")
      const { results } = await res.json()
      setSelectedJob(job)
      setSelectedResults(results ?? [])
      setResultsDialogOpen(true)
    } catch {
      toast.error(t('bulk.page.noResults'))
    }
  }

  return (
    <div className="space-y-6">
      <AnimatedGroup>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-500">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('bulk.page.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('bulk.page.subtitle')}</p>
            </div>
          </div>
        </div>
      </AnimatedGroup>

      <InView>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('bulk.page.dropZone')}</CardTitle>
          <CardDescription>{t('bulk.page.dropZoneDesc')}</CardDescription>
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
              {isDragging ? t('bulk.page.dropHere') : t('bulk.page.dragDrop')}
            </p>
            <p className="text-xs text-muted-foreground mb-4">{t('bulk.page.or')}</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = "" }}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              {t('bulk.page.addFilesManually')}
            </Button>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t('bulk.page.filesSelected', { count: files.length })}</p>
                <Button variant="ghost" size="sm" onClick={() => setFiles([])}>
                  <Trash2 className="h-3 w-3 mr-1" /> {t('bulk.page.clearAll')}
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
                {t('bulk.page.processBatch', { count: files.length })}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      </InView>

      <InView delay={0.08}>
      <Card>
        <CardHeader>
          <CardTitle>{t('bulk.page.batchHistory')}</CardTitle>
          <CardDescription>{t('bulk.page.batchCount', { count: batches.length })}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <Layers className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-sm text-muted-foreground">{t('bulk.page.noBatchJobs')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('bulk.page.dropFilesHint')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('bulk.page.jobId')}</TableHead>
                  <TableHead>{t('bulk.page.files')}</TableHead>
                  <TableHead>{t('bulk.page.status')}</TableHead>
                  <TableHead>{t('bulk.page.progress')}</TableHead>
                  <TableHead>{t('bulk.page.errorsLabel')}</TableHead>
                  <TableHead>{t('bulk.page.created')}</TableHead>
                  <TableHead className="text-right">{t('bulk.page.actions')}</TableHead>
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
                        <Eye className="h-3 w-3 mr-1" /> {t('bulk.page.results')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </InView>

      <Dialog open={resultsDialogOpen} onOpenChange={setResultsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('bulk.page.batchResults', { jobId: selectedJob?.id.slice(0, 8) ?? '' })}...</DialogTitle>
            <DialogDescription>
              {t('bulk.page.resultSummary', { files: selectedJob?.files.length ?? 0, succeeded: selectedResults.filter(r => r.status === 'success').length, failed: selectedResults.filter(r => r.status === 'error').length })}
            </DialogDescription>
          </DialogHeader>
          {selectedResults.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t('bulk.page.noResults')}</p>
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
                        ? <><CheckCircle2 className="h-3 w-3 mr-1" /> {t('bulk.page.success')}</>
                        : <><AlertCircle className="h-3 w-3 mr-1" /> {t('bulk.page.error')}</>
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
            <Button variant="outline" onClick={() => setResultsDialogOpen(false)}>{t('bulk.page.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
