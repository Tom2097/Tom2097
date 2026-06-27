"use client"

import { useState, useEffect } from "react"
import { Phone, Mail, MessageSquare, Calendar, FileText, CheckCircle2, ArrowRight, Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface TimelineEvent {
  id: string; type: string; title: string; description: string | null; timestamp: string
}

const iconMap: Record<string, React.ElementType> = {
  call: Phone, email: Mail, meeting: Calendar,
  whatsapp: MessageSquare, deal_stage: ArrowRight,
  note: FileText, task_completed: CheckCircle2,
}

const colorMap: Record<string, string> = {
  call: "bg-blue-500/10 text-blue-500",
  email: "bg-violet-500/10 text-violet-500",
  meeting: "bg-amber-500/10 text-amber-500",
  whatsapp: "bg-emerald-500/10 text-emerald-500",
  deal_stage: "bg-primary/10 text-primary",
  note: "bg-muted text-muted-foreground",
  task_completed: "bg-chart-2/10 text-chart-2",
}

export function CrmTimeline({ entityId, entityType }: { entityId?: string; entityType?: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showLogForm, setShowLogForm] = useState(false)
  const [logTitle, setLogTitle] = useState("")
  const [logDesc, setLogDesc] = useState("")

  useEffect(() => {
    const params = new URLSearchParams()
    if (entityId) params.set("entityId", entityId)
    if (entityType) params.set("entityType", entityType)
    params.set("limit", "20")

    fetch(`/api/v1/crm/timeline?${params}`)
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json() })
      .then((data) => setEvents(data.entries ?? data ?? []))
      .catch(() => setError("Could not load timeline"))
      .finally(() => setLoading(false))
  }, [entityId, entityType])

  const handleLogActivity = async () => {
    if (!logTitle.trim()) return
    try {
      const res = await fetch("/api/v1/crm/timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, entityType, title: logTitle, description: logDesc }),
      })
      if (res.ok) {
        const newEvent = await res.json()
        setEvents((prev) => [newEvent, ...prev])
        setLogTitle("")
        setLogDesc("")
        setShowLogForm(false)
      }
    } catch { /* ignore */ }
  }

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  if (error) return <div className="text-xs text-red-500 p-4 text-center">{error}</div>

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">Engagement Timeline</h3>
        <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => setShowLogForm(!showLogForm)}><Plus className="w-3 h-3" /> Log Activity</Button>
      </div>

      {showLogForm && (
        <div className="mb-4 p-3 rounded-xl border border-border/50 bg-muted/30 space-y-2">
          <input value={logTitle} onChange={(e) => setLogTitle(e.target.value)} placeholder="Activity title..." className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
          <input value={logDesc} onChange={(e) => setLogDesc(e.target.value)} placeholder="Description (optional)..." className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleLogActivity}>Save</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowLogForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {events.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No timeline events yet</p>}
      <div className="relative space-y-0">
        {events.map((event, i) => {
          const Icon = iconMap[event.type] || FileText
          return (
            <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
              {i < events.length - 1 && (
                <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border/50" />
              )}
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colorMap[event.type] || "bg-muted text-muted-foreground"}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{event.title}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(event.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {event.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{event.description}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}