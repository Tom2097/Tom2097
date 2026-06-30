"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Brain,
  Activity,
  AlertTriangle,
  BarChart3,
  Network,
  FileText,
  Zap,
  PlayCircle,
  Sparkles,
  X,
  ChevronUp,
  Search,
  Command,
  MessageSquare,
  Shield,
  TrendingUp,
  Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface CommandAction {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  action: () => void
  shortcut?: string
}

export function FloatingCommandBar() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState<string | null>(null)

  const actions: CommandAction[] = [
    {
      id: "briefing",
      label: "Daily Briefing",
      description: "Generate executive intelligence briefing",
      icon: <FileText className="h-4 w-4" />,
      action: () => {},
      shortcut: "B",
    },
    {
      id: "scan",
      label: "Run Monitor Scan",
      description: "Check all modules for anomalies",
      icon: <Activity className="h-4 w-4" />,
      action: () => {},
      shortcut: "M",
    },
    {
      id: "simulate",
      label: "What-If Simulation",
      description: "Simulate business impact scenarios",
      icon: <TrendingUp className="h-4 w-4" />,
      action: () => {},
      shortcut: "S",
    },
    {
      id: "orchestrate",
      label: "Run Orchestration",
      description: "Execute multi-step intelligence workflow",
      icon: <Zap className="h-4 w-4" />,
      action: () => {},
      shortcut: "O",
    },
    {
      id: "graph",
      label: "View Causal Graph",
      description: "Cross-module entity relationship map",
      icon: <Network className="h-4 w-4" />,
      action: () => {},
      shortcut: "G",
    },
    {
      id: "compliance",
      label: "Compliance Scan",
      description: "Check certification gaps and expirations",
      icon: <Shield className="h-4 w-4" />,
      action: () => {},
      shortcut: "C",
    },
  ]

  const runAction = async (action: CommandAction) => {
    setIsLoading(action.id)
    setIsOpen(false)

    switch (action.id) {
      case "briefing":
        try {
          const res = await fetch("/api/v1/intelligence/briefing", { method: "POST" })
          const data = await res.json()
          console.log("Briefing generated:", data)
        } catch (e) {
          console.error("Briefing failed:", e)
        }
        break
      case "scan":
        try {
          const res = await fetch("/api/v1/intelligence/monitor", { method: "POST" })
          const data = await res.json()
          console.log("Monitor scan done:", data.summary)
        } catch (e) {
          console.error("Scan failed:", e)
        }
        break
      case "simulate":
        try {
          const res = await fetch("/api/v1/intelligence/simulate", {
            method: "POST",
            body: JSON.stringify({ scenario: "What if compliance gap grows by 50%?" }),
          })
          const data = await res.json()
          console.log("Simulation done:", data.summary)
        } catch (e) {
          console.error("Simulation failed:", e)
        }
        break
      case "orchestrate":
        try {
          const res = await fetch("/api/v1/intelligence/orchestrate", {
            method: "POST",
            body: JSON.stringify({ intent: "prepare_for_audit" }),
          })
          const data = await res.json()
          console.log("Orchestration done:", data)
        } catch (e) {
          console.error("Orchestration failed:", e)
        }
        break
      case "graph":
        window.dispatchEvent(new CustomEvent("intelligence:focus-graph"))
        break
      default:
        break
    }

    setIsLoading(null)
  }

  const filtered = query
    ? actions.filter(
        (a) =>
          a.label.toLowerCase().includes(query.toLowerCase()) ||
          a.description.toLowerCase().includes(query.toLowerCase()),
      )
    : actions

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="w-[480px] max-w-[90vw]"
          >
            <Card className="border-border/50 shadow-xl backdrop-blur-xl bg-background/95">
              <CardContent className="p-3">
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search commands..."
                    className="pl-9 h-10 bg-secondary/30 border-0 focus-visible:ring-1"
                    autoFocus
                  />
                </div>
                <div className="space-y-1 max-h-[280px] overflow-y-auto">
                  {filtered.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => runAction(action)}
                      disabled={isLoading === action.id}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                        "hover:bg-secondary/50 disabled:opacity-50",
                      )}
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary">
                        {action.icon}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium">{action.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {action.description}
                        </div>
                      </div>
                      {action.shortcut && (
                        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono rounded bg-secondary/50 text-muted-foreground">
                          <Command className="h-2.5 w-2.5" />
                          {action.shortcut}
                        </kbd>
                      )}
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      No commands found
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all",
          "shadow-lg backdrop-blur-xl border border-border/50",
          isOpen
            ? "bg-primary text-primary-foreground shadow-primary/25"
            : "bg-background/95 text-foreground hover:bg-secondary/80",
        )}
      >
        <Brain className="h-4 w-4" />
        {isOpen ? "Close" : "Intelligence"}
        {isOpen ? (
          <X className="h-3.5 w-3.5" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  )
}
