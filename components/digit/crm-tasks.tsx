"use client"

import { useState } from "react"
import { Plus, Circle, CheckCircle2, Clock, AlertCircle, MoreHorizontal, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface CrmTaskItem {
  id: string
  title: string
  description: string | null
  priority: string
  status: string
  due_at: string | null
  assigned_to: string | null
  entity: string | null
}

const mockTasks: CrmTaskItem[] = [
  { id: "1", title: "Follow up with Rahul Sharma", description: "Send proposal and schedule demo", priority: "high", status: "pending", due_at: new Date(Date.now() + 1 * 86400000).toISOString(), assigned_to: "You", entity: "TechCorp" },
  { id: "2", title: "Prepare compliance module demo", description: "Create custom demo for healthcare vertical", priority: "high", status: "in_progress", due_at: new Date(Date.now() + 2 * 86400000).toISOString(), assigned_to: "You", entity: "PharmaLabs" },
  { id: "3", title: "Send thank-you email", description: "Post-meeting follow-up", priority: "medium", status: "pending", due_at: new Date(Date.now() + 3 * 86400000).toISOString(), assigned_to: null, entity: "GreenEnergy" },
  { id: "4", title: "Update deal stage", description: "Move TechCorp deal to negotiation", priority: "medium", status: "pending", due_at: new Date(Date.now() + 5 * 86400000).toISOString(), assigned_to: "You", entity: "TechCorp" },
  { id: "5", title: "Review pricing proposal", description: "Check discount structure for enterprise", priority: "low", status: "completed", due_at: null, assigned_to: null, entity: null },
]

const priorityStyles: Record<string, string> = {
  urgent: "text-red-500",
  high: "text-amber-500",
  medium: "text-blue-500",
  low: "text-muted-foreground",
}

const statusStyles: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/10 text-blue-500",
  completed: "bg-emerald-500/10 text-emerald-500",
  cancelled: "bg-muted text-muted-foreground line-through",
}

export function CrmTasks() {
  const [tasks, setTasks] = useState(mockTasks)
  const [filter, setFilter] = useState<string>("all")

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.status === filter)

  const toggleComplete = (id: string) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: t.status === "completed" ? "pending" : "completed" } : t))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border border-border/50 p-0.5 bg-secondary/30">
          {["all", "pending", "in_progress", "completed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn("px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors", filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
            >
              {f === "in_progress" ? "In Progress" : f}
            </button>
          ))}
        </div>
        <Button size="sm" className="gap-1 h-7 text-xs"><Plus className="w-3 h-3" /> Add Task</Button>
      </div>

      <div className="space-y-2">
        {filtered.map((task) => (
          <Card key={task.id} className={cn("p-3 border-border/50 flex items-start gap-3", task.status === "completed" && "opacity-60")}>
            <button onClick={() => toggleComplete(task.id)} className="mt-0.5 shrink-0">
              {task.status === "completed" ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={cn("text-sm font-medium", task.status === "completed" ? "line-through text-muted-foreground" : "text-foreground")}>{task.title}</p>
                <span className={cn("text-[10px] font-medium", priorityStyles[task.priority])}>{task.priority}</span>
              </div>
              {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                {task.due_at && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Due {new Date(task.due_at).toLocaleDateString()}</span>}
                {task.assigned_to && <span className="flex items-center gap-1"><User className="w-3 h-3" />{task.assigned_to}</span>}
                {task.entity && <span>{task.entity}</span>}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"><MoreHorizontal className="w-3 h-3" /></Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
