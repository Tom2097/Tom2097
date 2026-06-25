"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Lightbulb, Target, Phone, Send, Calendar, TrendingUp, Star, Zap, MessageSquare, Mail } from "lucide-react"

interface ActionSuggestion {
  id: string; deal: string; action: string; impact: "high" | "medium" | "low"
  reason: string; channel: string; value: number
}

const suggestions: ActionSuggestion[] = [
  { id: "a1", deal: "Acme Corp — Enterprise License", action: "Schedule exec-to-exec meeting", impact: "high", reason: "Decision-maker went quiet 14 days ago", channel: "meeting", value: 120000 },
  { id: "a2", deal: "GreenEnergy — Platform Subscription", action: "Send ROI case study follow-up", impact: "high", reason: "Proposal sent 10 days ago, no response", channel: "email", value: 85000 },
  { id: "a3", deal: "BuildCorp — Operations Platform", action: "Create competitive comparison deck", impact: "medium", reason: "Competitor discount offer surfaced", channel: "document", value: 65000 },
  { id: "a4", deal: "DataFlow — Analytics Add-on", action: "Identify new champion in the account", impact: "high", reason: "Champion left the company", channel: "call", value: 35000 },
  { id: "a5", deal: "All active deals", action: "Send monthly product update newsletter", impact: "medium", reason: "Re-engage all active deal contacts", channel: "email", value: 505000 },
]

const impactColors = { high: "text-red-500 bg-red-500/10", medium: "text-amber-500 bg-amber-500/10", low: "text-green-500 bg-green-500/10" }
const channelIcons = { email: Mail, meeting: Calendar, call: Phone, document: Star }

export function CrmNextBestAction() {
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
          const Icon = channelIcons[s.channel as keyof typeof channelIcons]
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
