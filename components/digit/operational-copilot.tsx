"use client"

import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bot, Send, Loader2, User, Sparkles } from "lucide-react"
import { toast } from "sonner"

interface Message {
  role: "user" | "assistant"
  content: string
  action?: { type: string; label: string; details?: string }
}

export function OperationalCopilot() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm your operational copilot. I can process documents, extract data, create tasks, and trigger workflows. What would you like to do?" },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [executingAction, setExecutingAction] = useState<number | null>(null)
  const [doneActions, setDoneActions] = useState<Set<number>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: userMsg }])
    setLoading(true)

    try {
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, history: messages.slice(-6) }),
      })
      const data = await res.json()
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.response ?? "I couldn't process that. Could you rephrase?",
        action: data.action ? { type: data.action.type, label: data.action.label, details: data.action.details } : undefined,
      }])
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }])
    } finally { setLoading(false) }
  }

  return (
    <Card className="h-[500px] flex flex-col overflow-hidden">
      <CardHeader className="p-4 pb-2 shrink-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          Operational Copilot
          <Badge variant="secondary" className="text-[10px] ml-auto">AI-powered</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 flex flex-col min-h-0">
        <ScrollArea ref={scrollRef as React.RefObject<HTMLDivElement>} className="flex-1 min-h-0 px-4 py-2">
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3 w-3 text-primary" />
                  </div>
                )}
                <div className={`max-w-[80%] min-w-0 ${msg.role === "user" ? "order-first" : ""}`}>
                  <div className={`p-2.5 rounded-lg text-sm whitespace-pre-wrap break-words ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {msg.content}
                  </div>
                  {msg.action && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1 text-xs h-7"
                      disabled={executingAction === i || doneActions.has(i)}
                      onClick={async () => {
                        setExecutingAction(i)
                        try {
                          const res = await fetch("/api/v1/operations/execute-action", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: msg.action }),
                          })
                          const data = await res.json()
                          if (res.ok) {
                            toast.success(`${msg.action!.label} done`)
                            setDoneActions((prev) => new Set(prev).add(i))
                          } else {
                            toast.error(data.error || "Action failed")
                          }
                        } catch {
                          toast.error("Action failed")
                        } finally {
                          setExecutingAction(null)
                        }
                      }}
                    >
                      {executingAction === i ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      {doneActions.has(i) ? "Done" : msg.action.label}
                    </Button>
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
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
                <div className="p-2.5 rounded-lg bg-muted">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="p-3 border-t border-border">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage() }} className="flex gap-2">
            <Input placeholder="Ask me to process a document, extract data, or run a workflow..." value={input} onChange={(e) => setInput(e.target.value)} className="text-sm" />
            <Button type="submit" size="icon" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}
