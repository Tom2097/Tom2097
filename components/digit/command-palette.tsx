"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Search, FileText, BarChart3, Settings, Users, Workflow, Upload, Command } from "lucide-react"

interface CommandItem {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  action: () => void
  keywords: string[]
}

const defaultCommands = (router: ReturnType<typeof useRouter>): CommandItem[] => [
  { id: "nav-documents", label: "Go to Documents", description: "Navigate to document management", icon: <FileText className="h-4 w-4" />, action: () => router.push("/documents"), keywords: ["docs", "files", "upload", "documents"] },
  { id: "nav-analytics", label: "Go to Analytics", description: "View analytics dashboard", icon: <BarChart3 className="h-4 w-4" />, action: () => router.push("/analytics"), keywords: ["analytics", "dashboard", "metrics", "reports"] },
  { id: "nav-settings", label: "Open Settings", description: "Configure your workspace", icon: <Settings className="h-4 w-4" />, action: () => router.push("/settings"), keywords: ["settings", "preferences", "config", "profile"] },
  { id: "nav-crm", label: "Go to CRM", description: "Manage contacts and deals", icon: <Users className="h-4 w-4" />, action: () => router.push("/crm"), keywords: ["crm", "contacts", "customers", "deals", "sales"] },
  { id: "nav-workflows", label: "Go to Workflows", description: "Automate processes", icon: <Workflow className="h-4 w-4" />, action: () => router.push("/workflows"), keywords: ["workflows", "automation", "triggers", "actions"] },
  { id: "nav-upload", label: "Upload Document", description: "Upload a file for processing", icon: <Upload className="h-4 w-4" />, action: () => router.push("/documents?upload=true"), keywords: ["upload", "file", "import", "document"] },
]

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
        return c.label.toLowerCase().includes(q) || c.keywords.some((k) => k.includes(q))
      })
    : commands

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault()
      setIsOpen((prev) => !prev)
    }
    if (e.key === "Escape") setIsOpen(false)
  }, [])

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50)
    else setQuery("")
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
          onClick={() => setIsOpen(false)}
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
