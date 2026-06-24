"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FileText, Mail, Mic, Camera, Link, Upload, CheckCircle2, Clock, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface FeedItem {
  id: string
  name: string
  type: string
  classification: string | null
  status: string
  created_at: string
}

const sourceIcons: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  voice_transcript: <Mic className="h-4 w-4" />,
  scan: <Camera className="h-4 w-4" />,
  web_clip: <Link className="h-4 w-4" />,
  attachment: <Upload className="h-4 w-4" />,
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

  if (loading) return <div className="p-8 text-center text-muted-foreground text-sm">Loading feed...</div>

  return (
    <div className="divide-y divide-border">
      <AnimatePresence>
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors cursor-pointer"
            onClick={() => onSelectDoc?.({ id: item.id, name: item.name })}
          >
            <div className="text-muted-foreground">{sourceIcons[item.type] ?? <FileText className="h-4 w-4" />}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {item.classification && <Badge variant="outline" className="text-[10px] px-1.5">{item.classification}</Badge>}
                <span className="text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] ${statusColors[item.status] ?? "bg-muted text-muted-foreground"}`}>
              {item.status === "ready" ? <CheckCircle2 className="h-3 w-3" /> : item.status === "pending" ? <Clock className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
              {item.status}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
