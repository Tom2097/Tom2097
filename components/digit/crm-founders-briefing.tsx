"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sun, TrendingUp, AlertTriangle, Target, Users, DollarSign, Zap, Sparkles, ChevronRight, RefreshCw } from "lucide-react"

interface BriefingSection {
  title: string; icon: React.ReactNode; content: string; priority: "high" | "medium" | "low"; actionItems: string[]
}

export function CrmFoundersBriefing() {
  const [loading, setLoading] = useState(false)
  const [briefing, setBriefing] = useState<BriefingSection[] | null>(null)
  const [selectedSection, setSelectedSection] = useState<number | null>(null)

  const generateBriefing = async () => {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1500))
    setBriefing([
      {
        title: "Revenue Pulse", priority: "high",
        icon: <DollarSign className="h-4 w-4 text-emerald-500" />,
        content: "Yesterday: $24,500 in closed deals. Pipeline at $1.22M (+8% WoW). 3 deals in negotiation worth $350K total. Weighted forecast for this month: $405K. Top performer: Emma (closed $92K yesterday).",
        actionItems: ["Review Acme Corp negotiation strategy", "Approve GreenEnergy discount exception"],
      },
      {
        title: "Deals Needing Attention", priority: "high",
        icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
        content: "Acme Corp ($120K) — exec went quiet 14 days. DataFlow ($35K) — champion left company. BuildCorp ($65K) — competitor discount surfaced.",
        actionItems: ["Schedule exec-to-exec with Acme Corp CEO", "Identify new champion at DataFlow"],
      },
      {
        title: "Team Performance", priority: "medium",
        icon: <Users className="h-4 w-4 text-blue-500" />,
        content: "Team hit 87% of weekly quota. Emma leading at 142%, Mike at 93%, Sarah at 68% (needs coaching). Avg deal cycle: 32 days (target: 28).",
        actionItems: ["Schedule coaching session with Sarah", "Review Mike's stalled proposals"],
      },
      {
        title: "Market Signals", priority: "medium",
        icon: <TrendingUp className="h-4 w-4 text-cyan-500" />,
        content: "Manufacturing vertical up 23% (IIoT surge). Healthcare compliance spending accelerating. Tech sector AI investment at all-time high. Energy green subsidies creating opportunity.",
        actionItems: ["Create manufacturing targeted campaign", "Hire healthcare SDR specialist"],
      },
      {
        title: "Operational Health", priority: "low",
        icon: <Zap className="h-4 w-4 text-purple-500" />,
        content: "3 CAPAs overdue (all in Verification stage). 92% of support tickets resolved within SLA. 5 new feature requests from enterprise prospects. System uptime: 99.97%.",
        actionItems: ["Follow up on overdue CAPAs", "Review top 3 feature requests for roadmap"],
      },
    ])
    setLoading(false)
  }

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader className="p-4 pb-2 shrink-0">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Sun className="h-4 w-4 text-amber-500" />
            Founder&apos;s Daily Briefing
            <Badge variant="secondary" className="text-[10px]">AI-generated</Badge>
          </div>
          {briefing && (
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={generateBriefing} disabled={loading}>
              <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 flex flex-col">
        {!briefing && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <Sparkles className="h-10 w-10 text-primary/30 mb-3" />
            <p className="text-sm font-medium mb-1">Your Daily Briefing Awaits</p>
            <p className="text-xs text-muted-foreground mb-4">AI-powered summary of your CRM, pipeline, team, and market.</p>
            <Button onClick={generateBriefing}><Sparkles className="h-4 w-4 mr-1" />Generate Briefing</Button>
          </div>
        )}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="flex gap-1 justify-center">
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} className="w-2 h-2 rounded-full bg-primary"
                    animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Analyzing pipeline, team, and market data...</p>
            </div>
          </div>
        )}
        {briefing && !loading && (
          <ScrollArea className="flex-1 px-4 py-2">
            <div className="space-y-2">
              {briefing.map((section, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  className={`p-3 rounded-xl border cursor-pointer transition-colors ${selectedSection === i ? "border-primary/50 bg-primary/5" : "border-border/50 hover:border-primary/30"}`}
                  onClick={() => setSelectedSection(selectedSection === i ? null : i)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {section.icon}
                      <p className="text-sm font-medium">{section.title}</p>
                      <Badge variant={section.priority === "high" ? "destructive" : section.priority === "medium" ? "default" : "secondary"} className="text-[10px]">
                        {section.priority}
                      </Badge>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${selectedSection === i ? "rotate-90" : ""}`} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{section.content}</p>
                  {selectedSection === i && section.actionItems.length > 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-2 space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase">Action Items</p>
                      {section.actionItems.map((item, j) => (
                        <div key={j} className="flex items-center gap-2 text-xs p-1.5 rounded-lg hover:bg-muted/30">
                          <Target className="h-3 w-3 text-primary" />
                          {item}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
