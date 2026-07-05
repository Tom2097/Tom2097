"use client"

import { useState, useEffect, useRef } from 'react'
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
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [report, setReport] = useState<ReportResult | null>(null)
  const [mode, setMode] = useState<'file' | 'text'>('file')
  const [textInput, setTextInput] = useState('')
  const [textName, setTextName] = useState('')
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'loading'; msg: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let mounted = true
    fetch('/api/operations/documents').then(r => r.json()).then(d => {
      if (mounted && d.documents) setDocuments(d.documents)
    }).catch(() => {}).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const refresh = async () => {
    const r = await fetch('/api/operations/documents')
    const d = await r.json()
    if (d.documents) setDocuments(d.documents)
  }

  const showStatus = (type: 'success' | 'error' | 'loading', msg: string) => {
    setStatus({ type, msg })
    if (type !== 'loading') setTimeout(() => setStatus(null), 3000)
  }

  const uploadFile = async (file: File) => {
    setUploading(true)
    showStatus('loading', `Uploading ${file.name}...`)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/operations/upload', { method: 'POST', body: fd })
      if (!r.ok) throw new Error('Upload failed')
      showStatus('success', `${file.name} uploaded`)
      await refresh()
    } catch {
      showStatus('error', `Failed to upload ${file.name}`)
    } finally {
      setUploading(false)
    }
  }

  const uploadText = async () => {
    if (!textInput.trim() || !textName.trim()) return
    setUploading(true)
    showStatus('loading', 'Saving text...')
    try {
      const r = await fetch('/api/operations/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textInput, name: textName }),
      })
      if (!r.ok) throw new Error('Upload failed')
      showStatus('success', 'Text saved')
      setTextInput('')
      setTextName('')
      await refresh()
    } catch {
      showStatus('error', 'Failed to save text')
    } finally {
      setUploading(false)
    }
  }

  const deleteDoc = async (id: string) => {
    const r = await fetch('/api/operations/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (r.ok) {
      setDocuments(p => p.filter(d => d.id !== id))
      setSelected(p => { const n = new Set(p); n.delete(id); return n })
    }
  }

  const generateReport = async () => {
    if (selected.size === 0) return
    setGenerating(true)
    setReport(null)
    try {
      const r = await fetch('/api/operations/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: Array.from(selected) }),
      })
      const d = await r.json()
      if (d.report) setReport(d.report)
    } catch {} finally {
      setGenerating(false)
    }
  }

  const fmtSize = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`
  const fmtDate = (s: string) => new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <div>
      {/* Input Card */}
      <div className="mb-6 rounded-xl border border-border bg-card">
        <div className="flex border-b border-border">
          <button onClick={() => setMode('file')} className={cn("flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors", mode === 'file' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <FileUp className="h-4 w-4" /> Upload File
          </button>
          <button onClick={() => setMode('text')} className={cn("flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors", mode === 'text' ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <Type className="h-4 w-4" /> Paste Text
          </button>
        </div>

        <div className="p-4">
          {mode === 'file' ? (
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault() }}
              onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]) }}
              className="flex cursor-pointer items-center justify-center gap-4 rounded-lg border-2 border-dashed border-border px-6 py-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/20"
            >
              <input ref={fileRef} type="file" accept=".txt,.md,.csv,.xlsx,.xls,.json" onChange={e => { if (e.target.files?.length) uploadFile(e.target.files[0]); e.target.value = '' }} className="hidden" />
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Drop a file or click to upload</p>
                <p className="text-xs text-muted-foreground mt-0.5">TXT, MD, CSV, Excel, JSON</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <input type="text" value={textName} onChange={e => setTextName(e.target.value)} placeholder="Document name..." className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="Paste your content here..." rows={4} className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">{textInput.length > 0 ? `${textInput.length} chars` : ''}</span>
                <Button size="sm" onClick={uploadText} disabled={!textInput.trim() || !textName.trim() || uploading}>
                  {uploading ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Saving</> : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status */}
      {status && (
        <div className={cn("mb-4 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm", status.type === 'success' ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : status.type === 'error' ? "border-red-500/30 bg-red-500/10 text-red-600" : "border-primary/30 bg-primary/5 text-foreground")}>
          {status.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : status.type === 'error' ? <AlertCircle className="h-4 w-4 shrink-0" /> : <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
          {status.msg}
        </div>
      )}

      {/* Toolbar */}
      {!loading && documents.length > 0 && (
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{documents.length} document{documents.length !== 1 ? 's' : ''}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set(documents.map(d => d.id)))} className="text-xs h-8">Select All</Button>
            <Button size="sm" onClick={generateReport} disabled={selected.size === 0 || generating} className="text-xs h-8">
              {generating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <BarChart3 className="mr-1 h-3 w-3" />}
              Report ({selected.size})
            </Button>
          </div>
        </div>
      )}

      {/* Document List */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : documents.length > 0 ? (
        <div className="mb-6 rounded-lg border border-border divide-y divide-border">
          {documents.map(doc => (
            <div key={doc.id} className={cn("flex items-center gap-3 px-4 py-2.5 transition-colors", selected.has(doc.id) ? "bg-primary/5" : "hover:bg-muted/20")}>
              <input type="checkbox" checked={selected.has(doc.id)} onChange={() => setSelected(p => { const n = new Set(p); if (n.has(doc.id)) n.delete(doc.id); else n.add(doc.id); return n })} className="h-4 w-4 shrink-0 rounded border-border" />
              {doc.name.endsWith('.xlsx') || doc.name.endsWith('.csv') ? <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-500" /> : <FileText className="h-4 w-4 shrink-0 text-blue-500" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{doc.name}</p>
                <p className="text-xs text-muted-foreground">{fmtSize(doc.file_size)} &middot; {fmtDate(doc.created_at)}</p>
              </div>
              <button onClick={() => deleteDoc(doc.id)} className="shrink-0 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-dashed border-border py-10 text-center">
          <FileText className="mx-auto mb-1 h-6 w-6 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No documents yet</p>
        </div>
      )}

      {/* Report */}
      {report && (
        <div className="rounded-lg border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5">
          <div className="flex items-center justify-between border-b border-emerald-500/20 px-4 py-3">
            <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-emerald-500" /><span className="text-sm font-medium text-foreground">Report</span></div>
            <button onClick={() => setReport(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground">{report.summary}</p>
            {report.insights && typeof report.insights === 'object' && !Array.isArray(report.insights) && 'total_rows' in report.insights && (
              <div className="flex gap-3">
                <div className="rounded-lg bg-background/50 px-4 py-2 text-center flex-1"><p className="text-lg font-bold text-foreground">{String(report.insights.total_rows)}</p><p className="text-xs text-muted-foreground">Rows</p></div>
                {'columns' in report.insights && Array.isArray(report.insights.columns) && <div className="rounded-lg bg-background/50 px-4 py-2 text-center flex-1"><p className="text-lg font-bold text-foreground">{report.insights.columns.length}</p><p className="text-xs text-muted-foreground">Columns</p></div>}
                {'document_count' in report.insights && <div className="rounded-lg bg-background/50 px-4 py-2 text-center flex-1"><p className="text-lg font-bold text-foreground">{String(report.insights.document_count)}</p><p className="text-xs text-muted-foreground">Docs</p></div>}
              </div>
            )}
             {'statistics' in (report.insights || {}) && typeof report.insights.statistics === 'object' && (
              <div className="overflow-x-auto rounded-lg border border-border/50">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border/50 bg-muted/30"><th className="px-3 py-1.5 text-left font-medium text-foreground">Column</th><th className="px-3 py-1.5 text-right font-medium text-muted-foreground">Count</th><th className="px-3 py-1.5 text-right font-medium text-muted-foreground">Sum</th><th className="px-3 py-1.5 text-right font-medium text-muted-foreground">Avg</th><th className="px-3 py-1.5 text-right font-medium text-muted-foreground">Min</th><th className="px-3 py-1.5 text-right font-medium text-muted-foreground">Max</th></tr></thead>
                  <tbody>
                     {Object.entries(report.insights.statistics as Record<string, Record<string, number | string>>).map(([col, stats]) => (
                      <tr key={col} className="border-b border-border/30 last:border-0"><td className="px-3 py-1.5 font-medium text-foreground">{col}</td><td className="px-3 py-1.5 text-right text-muted-foreground">{String(stats.count ?? '-')}</td><td className="px-3 py-1.5 text-right text-muted-foreground">{String(stats.sum ?? '-')}</td><td className="px-3 py-1.5 text-right text-muted-foreground">{String(stats.average ?? '-')}</td><td className="px-3 py-1.5 text-right text-muted-foreground">{String(stats.min ?? '-')}</td><td className="px-3 py-1.5 text-right text-muted-foreground">{String(stats.max ?? '-')}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-muted-foreground pt-2 border-t border-emerald-500/20"><Table className="inline h-3 w-3 mr-1" />{report.documents_analyzed} document(s) analyzed</p>
          </div>
        </div>
      )}
    </div>
  )
}