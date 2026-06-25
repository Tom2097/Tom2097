"use client"

import { useState } from "react"
import { Phone, Mail, MessageSquare, Calendar, FileText, CheckCircle2, ArrowRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface TimelineEvent {
  id: string
  type: string
  title: string
  description: string | null
  timestamp: string
}

const mockTimeline: TimelineEvent[] = [
  { id: "1", type: "call", title: "Intro call with Rahul Sharma", description: "Discussed platform requirements, interested in analytics module", timestamp: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: "2", type: "email", title: "Sent proposal for Professional plan", description: "Proposal #Q-2024-001 sent via email", timestamp: new Date(Date.now() - 24 * 3600000).toISOString() },
  { id: "3", type: "meeting", title: "Demo session with TechCorp team", description: "Full platform demo, 4 attendees", timestamp: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: "4", type: "deal_stage", title: "Deal moved to Proposal stage", description: "TechCorp deal valued at $50,000 moved to proposal", timestamp: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: "5", type: "note", title: "Follow-up notes", description: "Customer interested in compliance module add-on", timestamp: new Date(Date.now() - 7 * 86400000).toISOString() },
  { id: "6", type: "whatsapp", title: "WhatsApp check-in", description: "Sent quick update on timeline", timestamp: new Date(Date.now() - 10 * 86400000).toISOString() },
]

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
  const [events] = useState(mockTimeline)

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">Engagement Timeline</h3>
        <Button variant="outline" size="sm" className="gap-1 h-7 text-xs"><Plus className="w-3 h-3" /> Log Activity</Button>
      </div>
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
