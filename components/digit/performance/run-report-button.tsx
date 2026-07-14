"use client"

import { useState } from "react"
import { BarChart3, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SummaryData {
  total_events?: number
  unique_users?: number
  distinct_events?: number
  total_value?: number
}

interface RunResult {
  status: string
  result?: { sections?: Array<{ key: string; title: string; data: SummaryData | null; error?: string }> }
}

export function RunReportButton({ label }: { label: string }) {
  const [running, setRunning] = useState(false)
  const [run, setRun] = useState<RunResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runReport = async () => {
    setRunning(true)
    setError(null)
    setRun(null)
    try {
      const res = await fetch("/api/v1/performance/run-report", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to run report")
      setRun(data.run)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run report")
    } finally {
      setRunning(false)
    }
  }

  const summary = run?.result?.sections?.[0]

  return (
    <div className="relative">
      <Button onClick={runReport} disabled={running}>
        {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BarChart3 className="h-4 w-4 mr-2" />}
        {label}
      </Button>

      {(run || error) && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-card p-4 shadow-lg z-10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">{summary?.title ?? "Report"}</span>
            <button onClick={() => { setRun(null); setError(null) }} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {summary?.error && <p className="text-sm text-destructive">{summary.error}</p>}
          {summary?.data && !summary.error && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-secondary/30 p-2">
                <p className="text-xs text-muted-foreground">Total events</p>
                <p className="font-semibold">{summary.data.total_events ?? 0}</p>
              </div>
              <div className="rounded-lg bg-secondary/30 p-2">
                <p className="text-xs text-muted-foreground">Unique users</p>
                <p className="font-semibold">{summary.data.unique_users ?? 0}</p>
              </div>
              <div className="rounded-lg bg-secondary/30 p-2">
                <p className="text-xs text-muted-foreground">Distinct events</p>
                <p className="font-semibold">{summary.data.distinct_events ?? 0}</p>
              </div>
              <div className="rounded-lg bg-secondary/30 p-2">
                <p className="text-xs text-muted-foreground">Total value</p>
                <p className="font-semibold">{summary.data.total_value ?? 0}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
