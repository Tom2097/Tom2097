"use client"

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  FileText,
  X,
  Table,
  Loader2,
  FileSpreadsheet,
  Trash2,
  BarChart3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Document {
  id: string
  name: string
  type: string
  file_size: number
  created_at: string
}

interface ReportResult {
  summary: string
  insights: Record<string, unknown>
  documents_analyzed: number
}

export function DocumentUpload() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())
  const [report, setReport] = useState<ReportResult | null>(null)
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch('/api/operations/documents')
      const data = await res.json()
      if (data.documents) {
        setDocuments(data.documents)
      }
    } catch {
      console.error('Failed to fetch documents')
    } finally {
      setLoading(false)
    }
  }, [])

  useState(() => { fetchDocuments() })

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const uploadFile = async (file: File) => {
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/operations/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Upload failed')

      await fetchDocuments()
    } catch (err) {
      console.error('Upload error:', err)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    for (const file of Array.from(e.dataTransfer.files)) {
      uploadFile(file)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      for (const file of Array.from(e.target.files)) {
        uploadFile(file)
      }
      e.target.value = ''
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch('/api/operations/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      if (!res.ok) throw new Error('Delete failed')

      setDocuments(prev => prev.filter(d => d.id !== id))
      setSelectedDocs(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedDocs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleGenerateReport = async () => {
    if (selectedDocs.size === 0) return

    setIsGenerating(true)
    setReport(null)

    try {
      const res = await fetch('/api/operations/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: Array.from(selectedDocs) }),
      })

      const data = await res.json()
      if (data.report) {
        setReport(data.report)
      }
    } catch (err) {
      console.error('Report generation error:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase()
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
    return <FileText className="h-5 w-5 text-blue-500" />
  }

  return (
    <div className="space-y-6">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.csv,.xlsx,.xls,.json,.pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 font-medium text-foreground">
          {isDragging ? "Drop files here" : "Upload documents"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Supports: TXT, MD, CSV, Excel (.xlsx/.xls), JSON, PDF
        </p>
        {isUploading && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading...
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : documents.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Uploaded Documents ({documents.length})
            </h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedDocs(new Set(documents.map(d => d.id)))}
                className="text-xs"
              >
                Select All
              </Button>
              <Button
                size="sm"
                onClick={handleGenerateReport}
                disabled={selectedDocs.size === 0 || isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <BarChart3 className="mr-1 h-4 w-4" />
                )}
                Generate Report ({selectedDocs.size})
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <AnimatePresence>
              {documents.map((doc) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 50 }}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-4 py-3 transition-all",
                    selectedDocs.has(doc.id)
                      ? "border-primary/50 bg-primary/5"
                      : "border-border bg-card/50 hover:border-muted-foreground/30"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedDocs.has(doc.id)}
                      onChange={() => toggleSelect(doc.id)}
                      className="h-4 w-4 shrink-0 rounded border-border"
                    />
                    {getFileIcon(doc.name)}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.type} &middot; {formatSize(doc.file_size)} &middot;{" "}
                        {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(doc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border py-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">No documents uploaded yet</p>
          <p className="text-xs text-muted-foreground/70">
            Upload files above to get started
          </p>
        </div>
      )}

      {report && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-emerald-500" />
            <h3 className="font-semibold text-foreground">Generated Report</h3>
          </div>

          <p className="text-sm text-muted-foreground mb-4">{report.summary}</p>

          {report.insights && (
            <div className="space-y-3">
              {typeof report.insights === 'object' && report.insights !== null && !Array.isArray(report.insights) && (
                <>
                  {'total_rows' in report.insights && (
                    <div className="rounded-lg bg-background/50 px-4 py-3">
                      <p className="text-sm text-muted-foreground">
                        Total data rows: <span className="font-medium text-foreground">{String(report.insights.total_rows)}</span>
                      </p>
                      {'columns' in report.insights && Array.isArray(report.insights.columns) && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Columns: <span className="font-medium text-foreground">{report.insights.columns.join(', ')}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {'statistics' in report.insights && typeof report.insights.statistics === 'object' && report.insights.statistics !== null && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Column Statistics</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {Object.entries(report.insights.statistics as Record<string, Record<string, number | string>>).map(([col, stats]) => (
                          <div key={col} className="rounded-lg bg-background/50 px-4 py-3">
                            <p className="text-sm font-medium text-foreground">{col}</p>
                            <div className="mt-1 space-y-0.5">
                              {Object.entries(stats).map(([key, value]) => (
                                <p key={key} className="text-xs text-muted-foreground">
                                  {key}: <span className="font-medium text-foreground">{String(value)}</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {'document_count' in report.insights && (
                    <div className="rounded-lg bg-background/50 px-4 py-3">
                      <p className="text-sm text-muted-foreground">
                        Documents analyzed: <span className="font-medium text-foreground">{String(report.insights.document_count)}</span>
                      </p>
                      {'total_characters' in report.insights && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Total characters: <span className="font-medium text-foreground">{String(report.insights.total_characters)}</span>
                        </p>
                      )}
                      {'word_count' in report.insights && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Word count: <span className="font-medium text-foreground">{String(report.insights.word_count)}</span>
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Table className="h-3 w-3" />
            <span>Report generated from {report.documents_analyzed} document(s)</span>
          </div>
        </motion.div>
      )}
    </div>
  )
}