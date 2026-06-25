"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FileText, Mail, Mic, Camera, Link, Upload, CheckCircle2, Clock, AlertCircle, Sparkles, FileSearch, MessageSquare, ListTree, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface FeedItem {
  id: string; name: string; type: string
  classification: string | null; status: string; created_at: string
  content?: string
}

const sourceIcons: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  voice_transcript: <Mic className="h-4 w-4" />,
  scan: <Camera className="h-4 w-4" />,
  web_clip: <Link className="h-4 w-4" />,
  attachment: <Upload className="h-4 w-4" />,
  upload: <Upload className="h-4 w-4" />,
}

const statusColors: Record<string, string> = {
  pending: "text-yellow-500 bg-yellow-500/10",
  processing: "text-blue-500 bg-blue-500/10",
  ready: "text-green-500 bg-green-500/10",
  actioned: "text-muted-foreground bg-muted",
}

interface DocumentFeedProps {
  onSelectDoc?: (doc: { id: string; name: string; content?: string; extracted_entities?: Record<string, unknown> }) => void
}

export function DocumentFeed({ onSelectDoc }: DocumentFeedProps) {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [actionResults, setActionResults] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const res = await fetch("/api/v1/operations/feed")
        if (res.ok) {
          const { data } = await res.json()
          setItems(data ?? [])
        }
      } catch {} finally { setLoading(false) }
    }
    fetchFeed()
  }, [])

  const performAction = async (item: FeedItem, action: string) => {
    if (!item.content && action !== "view") return
    setProcessingId(item.id)

    try {
      if (action === "classify" || action === "extract" || action === "summarize") {
        const res = await fetch(`/api/v1/operations/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: item.id, content: item.content }),
        })
        const json = await res.json()
        if (json.success) {
          setActionResults((prev) => ({ ...prev, [`${item.id}-${action}`]: "done" }))
          const fetchRes = await fetch("/api/v1/operations/feed")
          if (fetchRes.ok) {
            const { data } = await fetchRes.json()
            setItems(data ?? [])
          }
        }
      } else if (action === "draft") {
        const res = await fetch("/api/v1/operations/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "draft_response", documentId: item.id, content: item.content, classification: item.classification }),
        })
        const json = await res.json()
        if (json.success) {
          setActionResults((prev) => ({ ...prev, [`${item.id}-draft`]: json.data?.response ?? "done" }))
        }
      } else if (action === "auto_create") {
        const res = await fetch("/api/v1/operations/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "auto_create", documentId: item.id, content: item.content, classification: item.classification }),
        })
        const json = await res.json()
        if (json.success) {
          setActionResults((prev) => ({ ...prev, [`${item.id}-auto`]: `Tasks: ${json.data?.tasks_created?.length ?? 0}, Recipe: ${json.data?.recipe_results?.length ?? 0} steps` }))
        }
      }
    } catch {} finally { setProcessingId(null) }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground text-sm">Loading feed...</div>

  return (
    <TooltipProvider>
      <div className="divide-y divide-border">
        <AnimatePresence>
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="group"
            >
              <div className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => onSelectDoc?.({ id: item.id, name: item.name, content: item.content })}>
                <div className="text-muted-foreground">{sourceIcons[item.type] ?? <FileText className="h-4 w-4" />}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.classification && <Badge variant="outline" className="text-[10px] px-1.5">{item.classification}</Badge>}
                    <span className="text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</span>
                    {actionResults[`${item.id}-auto`] && (
                      <span className="text-[10px] text-green-500">{actionResults[`${item.id}-auto`]}</span>
                    )}
                  </div>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] ${statusColors[item.status] ?? "bg-muted text-muted-foreground"}`}>
                  {item.status === "ready" ? <CheckCircle2 className="h-3 w-3" /> : item.status === "pending" ? <Clock className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                  {item.status}
                </div>
              </div>

              <div className="px-3 pb-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => performAction(item, "classify")} disabled={processingId === item.id}>
                      {processingId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      <span className="ml-1">Classify</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Auto-classify this document</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => performAction(item, "extract")} disabled={processingId === item.id}>
                      {processingId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileSearch className="h-3 w-3" />}
                      <span className="ml-1">Extract</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Extract structured data</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => performAction(item, "summarize")} disabled={processingId === item.id}>
                      {processingId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
                      <span className="ml-1">Summarize</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Generate a summary</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => performAction(item, "draft")} disabled={processingId === item.id}>
                      {processingId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                      <span className="ml-1">Draft</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Draft a response</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => performAction(item, "auto_create")} disabled={processingId === item.id}>
                      {processingId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ListTree className="h-3 w-3" />}
                      <span className="ml-1">Auto-Act</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Auto-create tasks & run recipes</TooltipContent>
                </Tooltip>
              </div>

              {actionResults[`${item.id}-draft`] && (
                <div className="px-3 pb-2">
                  <div className="p-2 bg-blue-500/5 border border-blue-500/20 rounded text-xs text-muted-foreground">
                    <p className="font-medium text-blue-500 mb-1">Draft Response:</p>
                    <p className="whitespace-pre-wrap">{actionResults[`${item.id}-draft`]}</p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  )
}
