"use client"

import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FileText, Database, MessageSquare, Send, Loader2, Bot, User } from "lucide-react"

interface SplitViewProps {
  document: { id: string; name: string; content?: string; extracted_entities?: Record<string, unknown> } | null
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export function SplitView({ document }: SplitViewProps) {
  const [activeView, setActiveView] = useState("document")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Ask me anything about this document." },
  ])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" })
  }, [chatMessages])

  if (!document) return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Select a document to view</div>

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const question = chatInput.trim()
    setChatInput("")
    setChatMessages((prev) => [...prev, { role: "user", content: question }])
    setChatLoading(true)

    try {
      const res = await fetch("/api/v1/operations/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: document.id, question }),
      })
      const json = await res.json()
      setChatMessages((prev) => [...prev, {
        role: "assistant",
        content: json.data?.answer ?? "I couldn't find an answer in this document.",
      }])
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error." }])
    } finally { setChatLoading(false) }
  }

  const extractedContent = document.extracted_entities
    ? (() => {
        try {
          return JSON.stringify(document.extracted_entities, null, 2)
        } catch { return "(unable to display)" }
      })()
    : null

  return (
    <div className="grid grid-cols-2 h-full border border-border rounded-lg overflow-hidden">
      <div className="border-r border-border flex flex-col">
        <div className="p-3 border-b border-border bg-muted/20 shrink-0">
          <p className="text-sm font-medium truncate">{document.name}</p>
        </div>
        <ScrollArea className="flex-1">
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words">{document.content ?? "(no content)"}</pre>
        </ScrollArea>
      </div>

      <div className="flex flex-col">
        <Tabs value={activeView} onValueChange={setActiveView} className="flex-1 flex flex-col">
          <TabsList className="grid grid-cols-3 mx-2 mt-2 shrink-0">
            <TabsTrigger value="extracted" className="text-xs"><Database className="h-3 w-3 mr-1" />Data</TabsTrigger>
            <TabsTrigger value="chat" className="text-xs"><MessageSquare className="h-3 w-3 mr-1" />AI Chat</TabsTrigger>
            <TabsTrigger value="document" className="text-xs"><FileText className="h-3 w-3 mr-1" />Raw</TabsTrigger>
          </TabsList>

          <TabsContent value="extracted" className="flex-1 p-4 mt-0 overflow-auto">
            {extractedContent ? (
              <pre className="text-xs font-mono whitespace-pre-wrap">{extractedContent}</pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Database className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No extracted data yet</p>
                <p className="text-xs text-muted-foreground mt-1">Use the Extract action in the feed</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="chat" className="flex-1 mt-0 flex flex-col">
             <ScrollArea ref={chatScrollRef as React.RefObject<HTMLDivElement>} className="flex-1 p-4">
              <div className="space-y-3">
                {chatMessages.map((msg, i) => (
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
                    <div className={`max-w-[80%] ${msg.role === "user" ? "order-first" : ""}`}>
                      <div className={`p-2.5 rounded-lg text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {msg.content}
                      </div>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-6 h-6 rounded-full bg-muted-foreground/20 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                  </motion.div>
                ))}
                {chatLoading && (
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
            <div className="p-3 border-t border-border shrink-0">
              <form onSubmit={(e) => { e.preventDefault(); sendChat() }} className="flex gap-2">
                <Input placeholder="Ask about this document..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} className="text-sm" />
                <Button type="submit" size="icon" disabled={chatLoading || !chatInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="document" className="flex-1 p-4 mt-0 overflow-auto">
            <pre className="text-xs font-mono whitespace-pre-wrap break-words">{document.content ?? "(no content)"}</pre>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
