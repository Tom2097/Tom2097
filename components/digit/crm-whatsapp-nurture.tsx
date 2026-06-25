"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Send, Clock, CheckCircle2, Phone, Mail, Calendar, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface NurtureStep {
  day: number; channel: string; subject: string; content: string; delay: string
}

const nurtureSequences = [
  {
    id: "w1", name: "Post-Demo Follow-up", prospect: "Acme Corp — John Smith",
    steps: [
      { day: 1, channel: "email", subject: "Thanks for your time", content: "Quick summary of what we covered and the recording link.", delay: "1h after demo" },
      { day: 3, channel: "whatsapp", subject: "Quick thought", content: "Hi John! Just following up — any initial reactions to the platform?", delay: "Day 3" },
      { day: 7, channel: "email", subject: "Case study: Similar company results", content: "How GreenEnergy achieved 40% efficiency with our platform.", delay: "Day 7" },
      { day: 10, channel: "phone", subject: "Check-in call", content: "10-min call to answer questions and discuss next steps.", delay: "Day 10" },
      { day: 14, channel: "whatsapp", subject: "Exclusive offer", content: "Extended trial by 14 days — no commitment needed.", delay: "Day 14" },
    ],
  },
  {
    id: "w2", name: "Cold Outreach", prospect: "MedTech — Sarah Chen",
    steps: [
      { day: 1, channel: "email", subject: "Idea for your compliance workflow", content: "Saw your team is expanding — we help MedTech companies automate compliance.", delay: "Day 1" },
      { day: 3, channel: "whatsapp", subject: "Quick video", content: "2-min video showing how our compliance module works. Worth a look?", delay: "Day 3" },
      { day: 7, channel: "email", subject: "Webinar invite", content: "Join our webinar on 'Automating Compliance in MedTech' this Thursday.", delay: "Day 7" },
      { day: 12, channel: "whatsapp", subject: "Last chance", content: "The webinar is tomorrow — I saved you a spot. Here's the link!", delay: "Day 12" },
    ],
  },
]

const channelIcons: Record<string, any> = { email: Mail, whatsapp: MessageSquare, phone: Phone, meeting: Calendar }

export function CrmWhatsAppNurture() {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-green-500" />
          <p className="text-sm font-medium">WhatsApp Nurture Sequences</p>
        </div>
        <Badge variant="secondary" className="text-[10px]">{nurtureSequences.length} active sequences</Badge>
      </div>

      <div className="space-y-3">
        {nurtureSequences.map((seq, i) => (
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
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0"><Send className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0"><CheckCircle2 className="h-3 w-3 text-green-500" /></Button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <Button variant="outline" className="w-full text-xs">
        <MessageSquare className="h-3 w-3 mr-1" />Create New Sequence
      </Button>
    </div>
  )
}
