"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageSquare, Send, Loader2, Bot, User } from "lucide-react"
import { LiveChart } from "@/components/digit/live-chart"

const sampleChartData = {
  deals: [
    { stage: "Lead", count: 12, value: 45000 },
    { stage: "Qualified", count: 8, value: 120000 },
    { stage: "Proposal", count: 5, value: 280000 },
    { stage: "Negotiation", count: 3, value: 350000 },
    { stage: "Won", count: 7, value: 520000 },
  ],
  monthly: [
    { month: "Jan", revenue: 320000 }, { month: "Feb", revenue: 380000 },
    { month: "Mar", revenue: 420000 }, { month: "Apr", revenue: 390000 },
    { month: "May", revenue: 450000 }, { month: "Jun", revenue: 480000 },
  ],
}

export function CrmAskYourCrm() {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string; chart?: { data: Array<Record<string, string | number>>; dataKey: string; type: "area" | "line" | "bar"; title: string } }>>([
    { role: "assistant", content: "Hi! Ask me anything about your CRM data. Try: \"Which deals close this month?\", \"What's my pipeline value?\", or \"Show me conversion by stage.\"" },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  })

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return
    const question = input.trim()
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: question }])
    setLoading(true)

    const lower = question.toLowerCase()
    let responseContent = ""

    const intentMap: Array<{ patterns: RegExp[]; handler: () => string }> = [
      {
        patterns: [/close this month/i, /close this quarter/i],
        handler: () => "**Deals Closing This Quarter**\n\n• **Acme Corp — Enterprise License** — $120,000 — Closing next week (95% confidence)\n• **GreenEnergy — Platform** — $85,000 — End of month (70% confidence)\n• **MedTech — Compliance** — $200,000 — Next 60 days (60% confidence)\n\n**Total expected: $405,000** (weighted: $277,500)\n\n⚠️ Acme Corp exec has gone quiet — recommend scheduling a call this week.",
      },
      {
        patterns: [/pipeline/, /total value/, /worth/],
        handler: () => "**Pipeline Summary**\n\n• Total Pipeline: **$1,225,000**\n• Weighted Forecast: **$798,000**\n• Open Deals: **16**\n• Win Rate: **63%**\n• Avg Deal Size: **$76,563**\n\nYour pipeline is healthy — 3 deals in negotiation worth $350k. Focus on moving the 5 proposal-stage deals forward.",
      },
      {
        patterns: [/conversion/, /stage/, /funnel/],
        handler: () => "**Stage Conversion Rates**\n\n• Lead → Qualified: **67%** (12 → 8)\n• Qualified → Proposal: **63%** (8 → 5)\n• Proposal → Negotiation: **60%** (5 → 3)\n• Negotiation → Won: **100%** (last 3 deals)\n\nYour biggest drop-off is **Qualified → Proposal**. Consider adding a technical demo step to improve conversion there.",
      },
      {
        patterns: [/at risk/, /stalled/, /gone quiet/, /attention/],
        handler: () => "**2 deals need attention:**\n\n1. **Acme Corp — Enterprise License** ($120k) — No decision-maker contact in 14 days. Schedule exec-to-exec.\n2. **DataFlow — Analytics Add-on** ($35k) — Champion left the company. Need to identify new stakeholder.\n\nBoth are in the critical path for this quarter's target.",
      },
    ]

    const matched = intentMap.find(({ patterns }) => patterns.some((p) => p.test(lower)))
    if (matched) {
      responseContent = matched.handler()
    } else {
      try {
        const res = await fetch("/api/v1/ai/crm-query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: question }),
        })
        if (res.ok) {
          const data = await res.json()
          responseContent = data.response
        }
      } catch {
        responseContent = "I can answer questions about pipeline, forecasts, conversion rates, and at-risk deals. Try one of those!"
      }
    }

    const showChart = /pipeline|close/.test(lower)
    setMessages((prev) => [...prev, {
      role: "assistant",
      content: responseContent,
      ...(showChart ? { chart: { data: sampleChartData.deals, dataKey: "value", type: "bar" as const, title: "Pipeline by Stage" } } : {}),
    }])
    setLoading(false)
  }, [input, loading])

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader className="p-4 pb-2 shrink-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessageSquare className="h-4 w-4 text-primary" />
          Ask Your CRM
          <Badge variant="secondary" className="text-[10px] ml-auto">Natural Language</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 flex flex-col">
        <ScrollArea ref={scrollRef} className="flex-1 px-4 py-2">
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3 w-3 text-primary" />
                  </div>
                )}
                <div className={`max-w-[85%] ${msg.role === "user" ? "order-first" : ""}`}>
                  <div className={`p-2.5 rounded-lg text-sm whitespace-pre-wrap ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {msg.content}
                  </div>
                  {msg.chart && (
                    <div className="mt-2 p-2 rounded-lg border border-border/50 bg-card">
                      <div className="h-[200px]">
                        <LiveChart data={msg.chart.data} dataKey={msg.chart.dataKey} type={msg.chart.type} height={200} color="hsl(var(--chart-2))" />
                      </div>
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-6 h-6 rounded-full bg-muted-foreground/20 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
              </motion.div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center"><Bot className="h-3 w-3 text-primary" /></div>
                <div className="p-2.5 rounded-lg bg-muted"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="p-3 border-t border-border shrink-0">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage() }} className="flex gap-2">
            <Input placeholder="Ask about your CRM data..." value={input} onChange={(e) => setInput(e.target.value)} className="text-sm" />
            <Button type="submit" size="icon" disabled={loading || !input.trim()}><Send className="h-4 w-4" /></Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}
