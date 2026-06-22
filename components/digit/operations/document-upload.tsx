"use client"

import { useState, useEffect, useRef } from 'react'
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
  FileUp,
  Type,
  CheckCircle2,
  AlertCircle,
  Download,
  Eye,
 Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file')
  const [textInput, setTextInput] = useState('')
  const [textName, setTextName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const res = await fetch('/api/operations/documents')
        const data = await res.json()
        if (mounted && data.documents) setDocuments(data.documents)
      } catch {
        console.error('Failed to fetch documents')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const refreshDocuments = async () => {
    try {
      const res = await fetch('/api/operations/documents')
      const data = await res.json()
      if (data.documents) setDocuments(data.documents)
    } catch {
      console.error('Failed to refresh documents')
    }
  }

  const uploadFile = async (file: File) => {
    setIsUploading(true)
    setUploadProgress(`Uploading ${file.name}...`)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/operations/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      setUploadProgress(`${file.name} uploaded successfully`)
      await refreshDocuments()
      setTimeout(() => setUploadProgress(null), 2000)
    } catch {
      setUploadProgress(`Failed to upload ${file.name}`)
      setTimeout(() => setUploadProgress(null), 3000)
    } finally {
      setIsUploading(false)
    }
  }

  const uploadText = async () => {
    if (!textInput.trim() || !textName.trim()) return
    setIsUploading(true)
    setUploadProgress('Saving text...')
    try {
      const res = await fetch('/api/operations/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textInput, name: textName }),
      })
      if (!res.ok) throw new Error('Upload failed')
      setUploadProgress('Text saved successfully')
      setTextInput('')
      setTextName('')
      await refreshDocuments()
      setTimeout(() => setUploadProgress(null), 2000)
    } catch {
      setUploadProgress('Failed to save text')
      setTimeout(() => setUploadProgress(null), 3000)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    for (const file of Array.from(e.dataTransfer.files)) uploadFile(file)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      for (const file of Array.from(e.target.files)) uploadFile(file)
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
      setSelectedDocs(prev => { const n = new Set(prev); n.delete(id); return n })
    } catch {
      console.error('Delete error')
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedDocs(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
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
      if (data.report) setReport(data.report)
    } catch {
      console.error('Report generation error')
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

  const filteredDocs = searchQuery
    ? documents.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : documents

  return (
    <div className="space-y-6">
      {/* Input Mode Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted p-1 w-fit">
        <button
          onClick={() => setInputMode('file')}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
            inputMode === 'file' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <FileUp className="h-4 w-4" />
          Upload File
        </button>
        <button
          onClick={() => setInputMode('text')}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
            inputMode === 'text' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Type className="h-4 w-4" />
          Paste Text
        </button>
      </div>

      {/* File Upload Mode */}
      {inputMode === 'file' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer",
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.csv,.xlsx,.xls,.json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium text-foreground">
            {isDragging ? "Drop files here" : "Drop files or click to upload"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            TXT &middot; MD &middot; CSV &middot; Excel (.xlsx/.xls) &middot; JSON
          </p>
        </div>
      )}

      {/* Text Input Mode */}
      {inputMode === 'text' && (
        <div className="space-y-4 rounded-xl border border-border p-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Document Name</label>
            <input
              type="text"
              value={textName}
              onChange={(e) => setTextName(e.target.value)}
              placeholder="e.g., Revenue Report Q2"
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">Content</label>
            <Textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste or type your text content here...&#10;&#10;Supported formats:&#10;- Plain text with numbers for analysis&#10;- CSV-style data (comma or tab separated)&#10;- JSON arrays of objects"
              rows={8}
              className="min-h-[200px] resize-y"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {textInput.length > 0 ? `${textInput.length} characters` : ''}
            </p>
            <Button
              onClick={uploadText}
              disabled={!textInput.trim() || !textName.trim() || isUploading}
            >
              {isUploading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><FileUp className="mr-2 h-4 w-4" /> Save Document</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Upload Progress Toast */}
      <AnimatePresence>
        {uploadProgress && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm",
              uploadProgress.includes('successfully')
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                : uploadProgress.includes('Failed')
                  ? "border-red-500/30 bg-red-500/10 text-red-600"
                  : "border-primary/30 bg-primary/5 text-foreground"
            )}
          >
            {uploadProgress.includes('successfully') ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : uploadProgress.includes('Failed') ? (
              <AlertCircle className="h-4 w-4 shrink-0" />
            ) : (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            )}
            {uploadProgress}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Document List */}
      <div className="rounded-xl border border-border/50 bg-card">
        <div className="flex flex-col gap-4 border-b border-border/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-semibold text-foreground">
            Documents ({documents.length})
          </h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-48"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedDocs(new Set(documents.map(d => d.id)))}
                disabled={documents.length === 0}
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
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredDocs.length > 0 ? (
          <div className="divide-y divide-border/50">
            <AnimatePresence>
              {filteredDocs.map((doc) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 transition-all",
                    selectedDocs.has(doc.id) ? "bg-primary/5" : "hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedDocs.has(doc.id)}
                      onChange={() => toggleSelect(doc.id)}
                      className="h-4 w-4 shrink-0 rounded border-border"
                    />
                    {getFileIcon(doc.name)}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatSize(doc.file_size)} &middot;{" "}
                        {new Date(doc.created_at).toLocaleDateString(undefined, {
                          month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
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
        ) : (
          <div className="py-12 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              {searchQuery ? 'No documents match your search' : 'No documents uploaded yet'}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {searchQuery ? 'Try a different search term' : 'Upload a file or paste text above'}
            </p>
          </div>
        )}
      </div>

      {/* Report Output */}
      <AnimatePresence>
        {report && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5"
          >
            <div className="flex items-center justify-between border-b border-emerald-500/20 px-6 py-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-500" />
                <h3 className="font-semibold text-foreground">Generated Report</h3>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setReport(null)}>
                  <Eye className="mr-1 h-3 w-3" />
                  View Details
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setReport(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">{report.summary}</p>

              {report.insights && typeof report.insights === 'object' && !Array.isArray(report.insights) && (
                <>
                  {'total_rows' in report.insights && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-lg bg-background/50 px-4 py-3 text-center">
                        <p className="text-2xl font-bold text-foreground">{String(report.insights.total_rows)}</p>
                        <p className="text-xs text-muted-foreground">Total Rows</p>
                      </div>
                      {'columns' in report.insights && Array.isArray(report.insights.columns) && (
                        <div className="rounded-lg bg-background/50 px-4 py-3 text-center">
                          <p className="text-2xl font-bold text-foreground">{report.insights.columns.length}</p>
                          <p className="text-xs text-muted-foreground">Columns</p>
                        </div>
                      )}
                      {'document_count' in report.insights && (
                        <div className="rounded-lg bg-background/50 px-4 py-3 text-center">
                          <p className="text-2xl font-bold text-foreground">{String(report.insights.document_count)}</p>
                          <p className="text-xs text-muted-foreground">Documents</p>
                        </div>
                      )}
                      {'word_count' in report.insights && (
                        <div className="rounded-lg bg-background/50 px-4 py-3 text-center">
                          <p className="text-2xl font-bold text-foreground">{String(report.insights.word_count)}</p>
                          <p className="text-xs text-muted-foreground">Words</p>
                        </div>
                      )}
                    </div>
                  )}

                  {'statistics' in report.insights && typeof report.insights.statistics === 'object' && report.insights.statistics !== null && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-foreground">Column Statistics</p>
                      <div className="overflow-x-auto rounded-lg border border-border/50">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border/50 bg-muted/30">
                              <th className="px-4 py-2 text-left font-medium text-foreground">Column</th>
                              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Count</th>
                              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Sum</th>
                              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Avg</th>
                              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Min</th>
                              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Max</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(report.insights.statistics as Record<string, Record<string, number | string>>).map(([col, stats]) => (
                              <tr key={col} className="border-b border-border/30 last:border-0">
                                <td className="px-4 py-2 font-medium text-foreground">{col}</td>
                                <td className="px-4 py-2 text-right text-muted-foreground">{String(stats.count ?? '-')}</td>
                                <td className="px-4 py-2 text-right text-muted-foreground">{String(stats.sum ?? '-')}</td>
                                <td className="px-4 py-2 text-right text-muted-foreground">{String(stats.average ?? '-')}</td>
                                <td className="px-4 py-2 text-right text-muted-foreground">{String(stats.min ?? '-')}</td>
                                <td className="px-4 py-2 text-right text-muted-foreground">{String(stats.max ?? '-')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-emerald-500/20">
                <Table className="h-3 w-3" />
                <span>Report generated from {report.documents_analyzed} document(s)</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}