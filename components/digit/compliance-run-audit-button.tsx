"use client"

import { useState } from "react"
import { Activity, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface AuditResult {
  question: string
  answer: string
  evidence: string[]
}

export function ComplianceRunAuditButton() {
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<AuditResult[] | null>(null)

  const handleRun = async () => {
    setRunning(true)
    setResults(null)
    setOpen(true)
    try {
      const res = await fetch("/api/v1/compliance/gap-audit", { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setResults(data.results ?? [])
      } else {
        setResults([])
      }
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <Button onClick={handleRun} disabled={running}>
        {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Activity className="h-4 w-4 mr-2" />}
        Run Audit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gap Analysis Audit</DialogTitle>
            <DialogDescription>Controls checked against submitted evidence, framework by framework</DialogDescription>
          </DialogHeader>
          {running ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : !results || results.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No frameworks with tracked controls yet, or nothing to flag</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-auto space-y-3">
              {results.map((r, i) => (
                <div key={i} className="p-3 rounded-lg border border-border/50">
                  <div className="flex items-start gap-2">
                    {r.answer.startsWith("No.") ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-chart-2 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{r.question}</p>
                      <p className="text-xs text-muted-foreground mt-1">{r.answer}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
