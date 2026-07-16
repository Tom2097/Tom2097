"use client"

import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageSquare, Send, Loader2, Bot, User } from "lucide-react"
import { LiveChart } from "@/components/digit/live-chart"

const SUGGESTIONS = [
  "Which deals close this month?",
  "What's my pipeline value?",
  "Show me conversion by stage.",
]

export function CrmAskYourCrm() {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string; chart?: { data: Array<Record<string, string | number>>; dataKey: string; type: "area" | "line" | "bar"; title: string } }>>([
    { role: "assistant", content: "Hi! Ask me anything about your CRM data — try one of the suggestions below, or type your own question." },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [pipelineData, setPipelineData] = useState<Array<Record<string, string | number>> | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/v1/crm/pipeline").then((r) => r.ok && r.json()).then((data) => {
      const stages = data?.pipeline?.stages ?? data?.stages ?? []
      if (stages.length > 0) setPipelineData(stages.map((s: unknown) => {
      const stage = s as { name: string; value: number };
      return { name: stage.name, value: stage.value };
    }))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  })

  const sendMessage = async (override?: string) => {
    const question = (override ?? input).trim()
    if (!question || loading) return
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: question }])
    setLoading(true)

    try {
      const res = await fetch("/api/v1/ai/crm-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: question }),
      })
      const responseContent = res.ok ? (await res.json()).response : "I couldn't process that query. Try asking about pipeline, deals, or forecasts."
      const showChart = /pipeline|close|stage|forecast|conversion/.test(question.toLowerCase()) && pipelineData && pipelineData.length > 0
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: responseContent,
        ...(showChart ? { chart: { data: pipelineData!, dataKey: "value", type: "bar" as const, title: "Pipeline by Stage" } } : {}),
      }])
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }])
    }
    setLoading(false)
  }

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
                <div className={`max-w-[85%] min-w-0 ${msg.role === "user" ? "order-first" : ""}`}>
                  <div className={`p-2.5 rounded-lg text-sm whitespace-pre-wrap break-words ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {msg.content}
                  </div>
                  {msg.chart && (
                    <div className="mt-2 p-2 rounded-lg border border-border/50 bg-card min-w-0">
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
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-3 shrink-0">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={loading}
                onClick={() => sendMessage(s)}
                className="rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
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