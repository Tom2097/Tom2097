"use client"

import { useState, useEffect } from "react"
import { Plus, Circle, CheckCircle2, Clock, AlertCircle, MoreHorizontal, User, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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
  const [tasks, setTasks] = useState<CrmTaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<string>("all")

  useEffect(() => {
    fetch("/api/v1/crm/tasks")
      .then((r) => r.ok ? r.json() : Promise.reject("Failed"))
      .then((data) => { setTasks(data.tasks || []); setLoading(false) })
      .catch(() => { setError("Failed to load tasks"); setLoading(false) })
  }, [])

  const toggleComplete = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "pending" : "completed"
    try {
      const res = await fetch(`/api/v1/crm/tasks?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: newStatus } : t))
    } catch { /* ignore */ }
  }

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.status === filter)

  if (loading) return <div className="text-xs text-muted-foreground p-4 text-center">Loading tasks...</div>
  if (error) return <div className="text-xs text-red-500 p-4 text-center">{error}</div>

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
            <button onClick={() => toggleComplete(task.id, task.status)} className="mt-0.5 shrink-0">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"><MoreHorizontal className="w-3 h-3" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => toggleComplete(task.id, task.status)}>
                  {task.status === "completed" ? <Circle className="mr-2 h-3 w-3" /> : <CheckCircle2 className="mr-2 h-3 w-3" />}
                  {task.status === "completed" ? "Reopen" : "Complete"}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => {
                  fetch(`/api/v1/crm/tasks?id=${task.id}`, { method: "DELETE" }).catch(() => {})
                  setTasks((prev) => prev.filter((t) => t.id !== task.id))
                }}>
                  <Trash2 className="mr-2 h-3 w-3" />Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Card>
        ))}
      </div>
    </div>
  )
}