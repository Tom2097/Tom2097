"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Copy, CheckCircle2, XCircle, AlertTriangle, Search, Users, Building2, FileText, Loader2 } from "lucide-react"

interface DuplicateItem {
  id: string; type: "contact" | "account" | "deal" | "lead"
  name: string; email?: string; phone?: string; matchScore: number
  existing: { name: string; email?: string; phone?: string }
  fields: Array<{ field: string; value1: string; value2: string; match: boolean }>
}

const typeIcons = { contact: Users, account: Building2, deal: FileText, lead: Users }

export function CrmDuplicateDetection() {
  const [duplicates, setDuplicates] = useState<DuplicateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState("")
  const [merging, setMerging] = useState<string | null>(null)

  const fetchDuplicates = async () => {
    try {
      const res = await fetch("/api/v1/ai/crm-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "Scan CRM for duplicate contacts, accounts, deals, or leads. Return ONLY valid JSON array. Each item: {id: string, type: \"contact\"/\"account\"/\"deal\"/\"lead\", name: string, email?: string, phone?: string, matchScore: 0-100, existing: {name: string, email?: string, phone?: string}, fields: [{field: string, value1: string, value2: string, match: boolean}]}. No markdown.",
        }),
      })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      const parsed = JSON.parse(data.response)
      setDuplicates(Array.isArray(parsed) ? parsed : [])
    } catch {
      setError("Could not detect duplicates")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    fetchDuplicates()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const handleMerge = async (id: string) => {
    setMerging(id)
    try {
      const res = await fetch("/api/v1/ai/crm-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `Merge duplicate record ${id} in CRM.` }),
      })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      const result = JSON.parse(data.response)
      if (!result?.ok) throw new Error("Merge failed")
      setDuplicates((prev) => prev.filter((d) => d.id !== id))
    } catch {
      setError("Merge failed")
    } finally {
      setMerging(null)
    }
  }

  const filtered = duplicates.filter(
    (d) => d.name.toLowerCase().includes(filter.toLowerCase()) || d.existing.name.toLowerCase().includes(filter.toLowerCase())
  )

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  if (error) return <div className="text-xs text-red-500 p-4 text-center">{error} <button onClick={fetchDuplicates} className="underline ml-1">Retry</button></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Copy className="h-5 w-5 text-orange-500" />
          <p className="text-sm font-medium">Duplicate Detection</p>
        </div>
        <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-500">{duplicates.length} found</Badge>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input placeholder="Search duplicates..." value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-8 text-sm" />
      </div>

      <ScrollArea className="h-[400px]">
        {filtered.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8">No duplicates found</p>
        : <div className="space-y-3">
          {filtered.map((item, i) => {
            const Icon = typeIcons[item.type]
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-3 rounded-xl border border-border/50"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">{item.name}</p>
                    <Badge className="text-[10px]" variant="secondary">{item.type}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {item.matchScore >= 90 ? (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                    <span className={`text-xs font-bold ${item.matchScore >= 90 ? "text-red-500" : "text-amber-500"}`}>
                      {item.matchScore}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <span className="line-through">{item.existing.name}</span>
                  <XCircle className="h-3 w-3 text-red-400" />
                  <span className="font-medium text-foreground">{item.name}</span>
                </div>

                <div className="space-y-1 mb-3">
                  {item.fields.map((f, j) => (
                    <div key={j} className="flex items-center gap-2 text-[11px]">
                      <span className="w-16 text-muted-foreground">{f.field}</span>
                      <span className="text-muted-foreground line-through">{f.value1}</span>
                      <span className={f.match ? "text-green-500" : "text-red-400"}>vs</span>
                      <span className="text-foreground">{f.value2}</span>
                      {f.match ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-400 ml-auto" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-[10px]" onClick={() => handleMerge(item.id)} disabled={merging === item.id}>
                    {merging === item.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                    Merge & Dedupe
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => {
                    fetch("/api/v1/ai/crm-query", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ query: `Discard duplicate record ${item.id} in CRM.` }),
                    }).catch(() => {})
                    setDuplicates((prev) => prev.filter((d) => d.id !== item.id))
                  }}>
                    <XCircle className="h-3 w-3 mr-1" />Discard New
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => {
                    fetch("/api/v1/ai/crm-query", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ query: `Keep both records for duplicate ${item.id} in CRM.` }),
                    }).catch(() => {})
                    setDuplicates((prev) => prev.filter((d) => d.id !== item.id))
                  }}>
                    Keep Both
                  </Button>
                </div>
              </motion.div>
            )
          })}
        </div>}
      </ScrollArea>
    </div>
  )
}