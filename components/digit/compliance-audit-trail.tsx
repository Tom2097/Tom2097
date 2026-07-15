"use client"

import { useEffect, useState } from "react"
import { History, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface AuditEntry {
  id: string
  record_type: string
  record_id: string
  action: string
  hash: string
  changed_by: string | null
  created_at: string
}

const actionColors: Record<string, string> = {
  CREATE: "bg-chart-2/20 text-chart-2",
  UPDATE: "bg-blue-500/20 text-blue-600",
  DELETE: "bg-red-500/20 text-red-600",
  SIGN: "bg-purple-500/20 text-purple-600",
  VERIFY: "bg-cyan-500/20 text-cyan-600",
  EXPORT: "bg-amber-500/20 text-amber-600",
  ARCHIVE: "bg-muted text-muted-foreground",
  DOWNLOAD: "bg-amber-500/20 text-amber-600",
  SEARCH: "bg-muted text-muted-foreground",
}

export function ComplianceAuditTrail() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/v1/compliance/audit-trail?limit=100")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card className="p-6 border-border/50 bg-card/50">
      <div className="mb-6">
        <h3 className="font-semibold text-foreground">Audit Trail</h3>
        <p className="text-sm text-muted-foreground">Tamper-evident, hash-chained log of every compliance-relevant change</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No audit entries yet</p>
          <p className="text-sm mt-1">Actions across frameworks, CAPAs, and signatures will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
              <div className="flex items-center gap-3 min-w-0">
                <Badge variant="secondary" className={actionColors[entry.action] ?? "bg-muted text-muted-foreground"}>
                  {entry.action}
                </Badge>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{entry.record_type}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{entry.record_id}</p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-4">
                <p className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground/70 font-mono">{entry.hash.slice(0, 12)}…</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
