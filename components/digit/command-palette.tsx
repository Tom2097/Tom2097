"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Search, FileText, BarChart3, Settings, Users, Workflow, Command, Brain, Shield, AlertTriangle, Activity } from "lucide-react"

interface CommandItem {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  action: () => void
  keywords: string[]
}

const defaultCommands = (router: ReturnType<typeof useRouter>): CommandItem[] => [
  { id: "nav-analytics", label: "Go to Analytics", description: "View analytics dashboard", icon: <BarChart3 className="h-4 w-4" />, action: () => router.push("/analytics"), keywords: ["analytics", "dashboard", "metrics", "reports"] },
  { id: "nav-settings", label: "Open Settings", description: "Configure your workspace", icon: <Settings className="h-4 w-4" />, action: () => router.push("/settings"), keywords: ["settings", "preferences", "config", "profile"] },
  { id: "nav-crm", label: "Go to CRM", description: "Manage contacts and deals", icon: <Users className="h-4 w-4" />, action: () => router.push("/crm"), keywords: ["crm", "contacts", "customers", "deals", "sales"] },
  { id: "nav-operations", label: "Go to Operations", description: "Process monitoring and document ingestion", icon: <Workflow className="h-4 w-4" />, action: () => router.push("/operations"), keywords: ["operations", "workflows", "automation", "triggers", "actions", "documents", "upload"] },
  { id: "nav-intelligence", label: "Open Intelligence", description: "AI Command Center", icon: <Brain className="h-4 w-4" />, action: () => router.push("/intelligence"), keywords: ["intelligence", "ai", "brain", "insights", "command center"] },
  { id: "act-run-monitor", label: "Run Monitor Scan", description: "Scan all modules for issues", icon: <Activity className="h-4 w-4" />, action: () => { fetch("/api/v1/intelligence/monitor", { method: "POST" }); router.push("/intelligence") }, keywords: ["scan", "monitor", "check", "audit", "run scan"] },
  { id: "act-briefing", label: "Generate Briefing", description: "Create an executive briefing", icon: <FileText className="h-4 w-4" />, action: () => { fetch("/api/v1/intelligence/briefing", { method: "POST" }); router.push("/intelligence") }, keywords: ["briefing", "brief", "summary", "executive summary", "morning briefing"] },
  { id: "act-causal-chains", label: "View Causal Chains", description: "Cross-module cause and effect relationships", icon: <Shield className="h-4 w-4" />, action: () => router.push("/intelligence"), keywords: ["causal", "cause", "effect", "chain", "relationship", "root cause"] },
  { id: "act-findings", label: "Show Active Findings", description: "View all active intelligence findings", icon: <AlertTriangle className="h-4 w-4" />, action: () => router.push("/intelligence"), keywords: ["findings", "alerts", "issues", "problems", "active"] },
]

// Intent-based routing maps natural language patterns to commands
function resolveIntent(query: string): { command?: string; params?: Record<string, string> } {
  const q = query.toLowerCase().trim()

  if (q.match(/^(show|find|list|get|view)\s+(expiring|cert|expir)/)) return { command: "nav-intelligence" }
  if (q.match(/^(run|start|execute)\s+(scan|monitor|check)/)) return { command: "act-run-monitor" }
  if (q.match(/^(generate|create|get)\s+(briefing|brief|summary)/)) return { command: "act-briefing" }
  if (q.match(/^(show|view|find)\s+(causal|cause|chain|root)/)) return { command: "act-causal-chains" }
  if (q.match(/^(show|list|view|get)\s+(finding|alert|issue|active)/)) return { command: "act-findings" }
  if (q.match(/^(go|open|navigate|goto)\s+(crm|sales|pipeline)/)) return { command: "nav-crm" }
  if (q.match(/^(go|open|navigate|goto)\s+(doc|file|document|upload)/)) return { command: "nav-operations" }
  if (q.match(/^(go|open|navigate|goto)\s+(analytics|metric|report)/)) return { command: "nav-analytics" }
  if (q.match(/^(go|open|navigate|goto)\s+(setting|pref)/)) return { command: "nav-settings" }
  if (q.match(/^(go|open|navigate|goto)\s+(workflow|automation|operation)/)) return { command: "nav-operations" }
  if (q.match(/^(upload|import|add)\s+(doc|file|document)/)) return { command: "nav-operations" }
  if (q.match(/^(what|how).*(risk|threat|danger)/)) return { command: "act-findings" }

  return {}
}

export function CommandPalette() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands = defaultCommands(router)

  const filtered = query.trim()
    ? commands.filter((c) => {
        const q = query.toLowerCase()
        if (c.label.toLowerCase().includes(q) || c.keywords.some((k) => k.includes(q))) return true
        const intent = resolveIntent(query)
        return intent.command === c.id || c.keywords.some((k) => k.includes(intent.command || ""))
      })
    : commands

  const close = useCallback(() => { setIsOpen(false); setQuery("") }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault()
      setIsOpen((prev) => { if (!prev) return true; setQuery(""); return false })
    }
    if (e.key === "Escape") close()
  }, [close])

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50)
  }, [isOpen])

  const execute = (cmd: CommandItem) => {
    setIsOpen(false)
    cmd.action()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-background/60 backdrop-blur-sm"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search commands..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0) }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1)) }
                  if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)) }
                  if (e.key === "Enter" && filtered[selectedIndex]) execute(filtered[selectedIndex])
                }}
                className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
              />
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted rounded border border-border">
                <Command className="h-3 w-3" />K
              </kbd>
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No commands found</p>
              ) : (
                filtered.map((cmd, i) => (
                  <button
                    key={cmd.id}
                    onClick={() => execute(cmd)}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${
                      i === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                    }`}
                  >
                    <span className="text-muted-foreground">{cmd.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{cmd.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{cmd.description}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
