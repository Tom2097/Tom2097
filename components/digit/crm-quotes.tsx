"use client"

import { useState, useEffect } from "react"
import { FileText, Plus, Eye, Send, CheckCircle2, XCircle, Download, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Quote {
  id: string
  title: string
  status: string
  value: number
  currency: string
  contact: string
  company: string
  valid_until: string | null
  created_at: string
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-500",
  viewed: "bg-amber-500/10 text-amber-500",
  accepted: "bg-emerald-500/10 text-emerald-500",
  rejected: "bg-red-500/10 text-red-500",
  expired: "bg-muted text-muted-foreground",
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 0 }).format(value)
}

export function CrmQuotes() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<string>("all")

  useEffect(() => {
    fetch("/api/v1/crm/quotes")
      .then((r) => r.ok ? r.json() : Promise.reject("Failed to load"))
      .then((data) => { setQuotes(data.quotes || []); setLoading(false) })
      .catch(() => { setError("Failed to load quotes"); setLoading(false) })
  }, [])

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/v1/crm/quotes?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      setQuotes((prev) => prev.map((q) => q.id === id ? { ...q, status } : q))
    } catch { /* ignore */ }
  }

  const filtered = filter === "all" ? quotes : quotes.filter((q) => q.status === filter)

  if (loading) return <div className="text-xs text-muted-foreground p-4 text-center">Loading quotes...</div>
  if (error) return <div className="text-xs text-red-500 p-4 text-center">{error}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border border-border/50 p-0.5 bg-secondary/30">
          {["all", "draft", "sent", "accepted", "rejected"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn("px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors", filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
            >
              {f}
            </button>
          ))}
        </div>
        <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> New Quote</Button>
      </div>

      <div className="space-y-2">
        {filtered.map((quote) => (
          <Card key={quote.id} className="p-4 border-border/50 hover:border-primary/30 transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground text-sm">{quote.title}</p>
                    <Badge className={cn("text-[10px] px-1.5 h-4 capitalize font-normal", statusColors[quote.status])}>{quote.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{quote.contact} · {quote.company}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{formatCurrency(quote.value, quote.currency)}</span>
                    {quote.valid_until && <span>Valid until {new Date(quote.valid_until).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateStatus(quote.id, quote.status === "draft" ? "sent" : quote.status)}>
                  {quote.status === "draft" ? <Send className="w-3.5 h-3.5" /> : quote.status === "sent" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                  const blob = new Blob([`Title: ${quote.title}\nValue: ${formatCurrency(quote.value, quote.currency)}\nStatus: ${quote.status}\nContact: ${quote.contact}\nCompany: ${quote.company}`], { type: "text/plain" })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url; a.download = `quote-${quote.id}.txt`; a.click()
                  URL.revokeObjectURL(url)
                }}><Download className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}