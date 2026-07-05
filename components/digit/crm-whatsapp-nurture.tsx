"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"

import { Badge } from "@/components/ui/badge"
import { MessageSquare, Send, Clock, CheckCircle2, Phone, Mail, Calendar, ArrowRight, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface NurtureStep {
  day: number; channel: string; subject: string; content: string; delay: string
}

interface NurtureSequence {
  id: string; name: string; prospect: string; steps: NurtureStep[]
}

const channelIcons: Record<string, React.ComponentType<{className?: string}>> = { email: Mail, whatsapp: MessageSquare, phone: Phone, meeting: Calendar }

export function CrmWhatsAppNurture() {
  const [sequences, setSequences] = useState<NurtureSequence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)

  const fetchSequences = async () => {
    try {
      const res = await fetch("/api/v1/ai/crm-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "Generate WhatsApp nurture sequences for CRM prospects. Return ONLY valid JSON array. Each item: {id: string, name: string, prospect: string, steps: [{day: number, channel: string, subject: string, content: string, delay: string}]}. No markdown.",
        }),
      })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      const parsed = JSON.parse(data.response)
      setSequences(Array.isArray(parsed) ? parsed : [])
    } catch {
      setError("Could not load sequences")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch("/api/v1/ai/crm-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "Generate WhatsApp nurture sequences for CRM prospects. Return ONLY valid JSON array. Each item: {id: string, name: string, prospect: string, steps: [{day: number, channel: string, subject: string, content: string, delay: string}]}. No markdown.",
      }),
    }).then((r) => r.ok ? r.json() : Promise.reject()).then((data) => {
      const parsed = JSON.parse(data.response)
      setSequences(Array.isArray(parsed) ? parsed : [])
    }).catch(() => setError("Could not load sequences"))
  }, [])

  const sendNow = async (id: string, step: NurtureStep) => {
    setSending(`${id}-${step.day}`)
    try {
      await fetch("/api/v1/crm/communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: step.channel,
          to_address: step.channel === "email" ? "prospect@example.com" : "+1234567890",
          subject: step.subject,
          body: step.content,
        }),
      })
    } catch {
      setError("Failed to send")
    } finally {
      setSending(null)
    }
  }

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  if (error) return <div className="text-xs text-red-500 p-4 text-center">{error} <button onClick={fetchSequences} className="underline ml-1">Retry</button></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-green-500" />
          <p className="text-sm font-medium">WhatsApp Nurture Sequences</p>
        </div>
        <Badge variant="secondary" className="text-[10px]">{sequences.length} active sequences</Badge>
      </div>

      {sequences.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8">No sequences yet</p>
      : <div className="space-y-3">
        {sequences.map((seq, i) => (
          <motion.div key={seq.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="rounded-xl border border-border/50 overflow-hidden"
          >
            <div className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/20"
              onClick={() => setExpanded(expanded === seq.id ? null : seq.id)}
            >
              <div>
                <p className="text-sm font-medium">{seq.name}</p>
                <p className="text-xs text-muted-foreground">{seq.prospect} · {seq.steps.length} steps</p>
              </div>
              <Badge variant="outline" className="text-[10px]">Active</Badge>
            </div>

            {expanded === seq.id && (
              <div className="px-3 pb-3 space-y-2">
                {seq.steps.map((step, j) => {
                  const Icon = channelIcons[step.channel] || MessageSquare
                  return (
                    <motion.div key={j} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: j * 0.05 }}
                      className="flex items-start gap-3 p-2 rounded-lg bg-muted/30"
                    >
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-primary">{j + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3 w-3 text-muted-foreground" />
                          <p className="text-xs font-medium">{step.channel === "whatsapp" ? "WhatsApp" : step.channel.charAt(0).toUpperCase() + step.channel.slice(1)}</p>
                          <span className="text-[10px] text-muted-foreground">· {step.delay}</span>
                        </div>
                        <p className="text-xs font-medium mt-0.5">{step.subject}</p>
                        <p className="text-[11px] text-muted-foreground">{step.content}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => sendNow(seq.id, step)} disabled={sending === `${seq.id}-${step.day}`}>
                          {sending === `${seq.id}-${step.day}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0"><CheckCircle2 className="h-3 w-3 text-green-500" /></Button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.div>
        ))}
      </div>}

      <Button variant="outline" className="w-full text-xs">
        <Plus className="h-3 w-3 mr-1" />Create New Sequence
      </Button>
    </div>
  )
}