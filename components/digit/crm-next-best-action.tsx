"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Lightbulb, Target, Phone, Send, Calendar, TrendingUp, Star, Zap, MessageSquare, Mail, Loader2 } from "lucide-react"

interface ActionSuggestion {
  id: string; deal: string; action: string; impact: "high" | "medium" | "low"
  reason: string; channel: string; value: number
}

const impactColors = { high: "text-red-500 bg-red-500/10", medium: "text-amber-500 bg-amber-500/10", low: "text-green-500 bg-green-500/10" }
const channelIcons: Record<string, React.ElementType> = { email: Mail, meeting: Calendar, call: Phone, document: Star, whatsapp: MessageSquare }

export function CrmNextBestAction() {
  const [suggestions, setSuggestions] = useState<ActionSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchActions = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/v1/ai/crm-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "Generate 5 next best actions for my CRM deals. Return ONLY valid JSON array with objects having: id (string), deal (string), action (string), impact (\"high\"/\"medium\"/\"low\"), reason (string), channel (string), value (number). No markdown.",
        }),
      })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      const parsed = JSON.parse(data.response)
      setSuggestions(Array.isArray(parsed) ? parsed : [])
    } catch {
      setError("Could not generate suggestions")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchActions() }, [])

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  if (error) return <div className="text-xs text-red-500 p-4 text-center">{error} <button onClick={fetchActions} className="underline ml-1">Retry</button></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <p className="text-sm font-medium">Next Best Actions</p>
        </div>
        <Badge variant="secondary" className="text-[10px]">AI-recommended</Badge>
      </div>

      <div className="space-y-2">
        {suggestions.map((s, i) => {
          const Icon = channelIcons[s.channel] || Send
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="p-3 rounded-xl border border-border/50 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium">{s.action}</p>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${impactColors[s.impact]}`}>
                      {s.impact === "high" ? "High" : s.impact === "medium" ? "Med" : "Low"} Impact
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{s.deal}</span>
                    <span>${s.value.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><Icon className="h-3 w-3" />{s.channel}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{s.reason}</p>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-[10px] shrink-0">
                  <Send className="h-3 w-3 mr-1" />Do It
                </Button>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}