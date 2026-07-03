"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sun, TrendingUp, AlertTriangle, Target, Users, DollarSign, Zap, Sparkles, ChevronRight, RefreshCw, Loader2 } from "lucide-react"

interface BriefingSection {
  title: string
  icon: React.ReactNode
  content: string
  priority: "high" | "medium" | "low"
  actionItems: string[]
}

function isBriefingSection(obj: unknown): obj is BriefingSection {
  if (typeof obj !== 'object' || obj === null) return false;
  const section = obj as BriefingSection;
  return typeof section.title === 'string' &&
         typeof section.content === 'string' &&
         ['high', 'medium', 'low'].includes(section.priority) &&
         Array.isArray(section.actionItems);
}

export function CrmFoundersBriefing() {
  const [loading, setLoading] = useState(false)
  const [briefing, setBriefing] = useState<BriefingSection[] | null>(null)
  const [selectedSection, setSelectedSection] = useState<number | null>(null)
  const [error, setError] = useState("")

  const generateBriefing = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/v1/ai/crm-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "Generate a daily briefing for a founder. Return ONLY valid JSON array with 5 objects. Each object: title (string), priority (\"high\"/\"medium\"/\"low\"), content (string - detailed paragraph), actionItems (array of strings). Cover: 1) Revenue Pulse, 2) Deals Needing Attention, 3) Team Performance, 4) Market Signals, 5) Operational Health. No markdown, no backticks.",
        }),
      })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      const parsed = JSON.parse(data.response)
      const sections: BriefingSection[] = (Array.isArray(parsed) ? parsed : []).map((s: unknown, i: number) => {
        if (!isBriefingSection(s)) {
          console.warn(`Invalid briefing section at index ${i}`);
          return {
            title: 'Invalid Section',
            content: 'Could not parse briefing section',
            icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
            priority: 'low',
            actionItems: []
          };
        }
        return {
          ...s,
          icon: [<DollarSign key="0" className="h-4 w-4 text-emerald-500" />, <AlertTriangle key="1" className="h-4 w-4 text-amber-500" />, <Users key="2" className="h-4 w-4 text-blue-500" />, <TrendingUp key="3" className="h-4 w-4 text-cyan-500" />, <Zap key="4" className="h-4 w-4 text-purple-500" />][i] || <Sparkles className="h-4 w-4 text-primary" />,
        };
      })
      setBriefing(sections)
    } catch {
      setError("Failed to generate briefing")
    } finally {
      setLoading(false)
    }
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
        {!briefing && !loading && !error && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <Sparkles className="h-10 w-10 text-primary/30 mb-3" />
            <p className="text-sm font-medium mb-1">Your Daily Briefing Awaits</p>
            <p className="text-xs text-muted-foreground mb-4">AI-powered summary of your CRM, pipeline, team, and market.</p>
            <Button onClick={generateBriefing}><Sparkles className="h-4 w-4 mr-1" />Generate Briefing</Button>
          </div>
        )}
        {(loading) && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
              <p className="text-xs text-muted-foreground">Analyzing pipeline, team, and market data...</p>
            </div>
          </div>
        )}
        {error && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <p className="text-xs text-red-500 mb-2">{error}</p>
            <Button size="sm" variant="outline" onClick={generateBriefing}>Retry</Button>
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