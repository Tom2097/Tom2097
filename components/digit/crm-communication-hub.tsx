"use client"

import { useState } from "react"
import { Send, Mail, MessageSquare, Phone, FileText, Plus, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface CommMessage {
  id: string
  channel: string
  direction: string
  subject: string
  body: string
  to: string
  from: string
  timestamp: string
}

const mockMessages: CommMessage[] = [
  { id: "1", channel: "email", direction: "outbound", subject: "Proposal for Professional Plan", body: "Dear Rahul, thank you for your interest...", to: "rahul@techcorp.com", from: "sales@digit-ai.org", timestamp: new Date(Date.now() - 1 * 3600000).toISOString() },
  { id: "2", channel: "whatsapp", direction: "inbound", subject: "Demo follow-up", body: "Thanks for the demo! When can we start?", to: "sales@digit-ai.org", from: "+91 98765 43210", timestamp: new Date(Date.now() - 3 * 3600000).toISOString() },
  { id: "3", channel: "email", direction: "inbound", subject: "Re: Platform inquiry", body: "We're particularly interested in the compliance module", to: "sales@digit-ai.org", from: "rahul@techcorp.com", timestamp: new Date(Date.now() - 24 * 3600000).toISOString() },
]

const templateOptions = [
  { name: "Follow-up after demo", subject: "Thanks for your time", body: "Dear {{name}}, it was great showing you DigiT..." },
  { name: "Proposal sent", subject: "Your proposal is ready", body: "Dear {{name}}, here is your custom proposal..." },
  { name: "Check-in", subject: "Checking in", body: "Hi {{name}}, just checking in to see if you have any questions..." },
]

export function CrmCommunicationHub() {
  const [channel, setChannel] = useState<string>("email")
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [showCompose, setShowCompose] = useState(false)

  const applyTemplate = (template: typeof templateOptions[0]) => {
    setSubject(template.subject)
    setBody(template.body)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Conversations</h3>
          <Button size="sm" className="gap-1 h-7 text-xs" onClick={() => setShowCompose(!showCompose)}>
            {showCompose ? "Cancel" : <><Send className="w-3 h-3" /> Compose</>}
          </Button>
        </div>

        {showCompose && (
          <Card className="p-4 border-primary/30 space-y-3">
            <div className="flex gap-2">
              {["email", "whatsapp", "sms"].map((c) => (
                <button key={c} onClick={() => setChannel(c)} className={cn("flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", channel === c ? "bg-primary/10 text-primary" : "bg-secondary/50 text-muted-foreground")}>
                  {c === "email" ? <Mail className="w-3 h-3" /> : c === "whatsapp" ? <MessageSquare className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Select onValueChange={(v) => applyTemplate(templateOptions.find((t) => t.name === v)!)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Use template..." /></SelectTrigger>
                <SelectContent>
                  {templateOptions.map((t) => <SelectItem key={t.name} value={t.name} className="text-xs">{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Input placeholder="To: email or phone" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 text-sm" />
              <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-8 text-sm" />
              <Textarea placeholder="Write your message..." value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="text-sm" />
            </div>
            <Button className="gap-1"><Send className="w-3 h-3" /> Send via {channel}</Button>
          </Card>
        )}

        <div className="space-y-2">
          {mockMessages.map((msg) => (
            <Card key={msg.id} className={cn("p-3 border-border/50", msg.direction === "inbound" ? "border-l-2 border-l-primary" : "border-l-2 border-l-muted")}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {msg.channel === "email" ? <Mail className="w-3.5 h-3.5 text-muted-foreground" /> : <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />}
                  <p className="text-sm font-medium text-foreground">{msg.subject}</p>
                  <Badge variant="outline" className="text-[10px] px-1 h-4">{msg.direction}</Badge>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{new Date(msg.timestamp).toLocaleDateString()}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{msg.body}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{msg.direction === "outbound" ? `To: ${msg.to}` : `From: ${msg.from}`}</p>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Templates</h3>
        <div className="space-y-2">
          {templateOptions.map((t) => (
            <Card key={t.name} className="p-3 border-border/50 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => applyTemplate(t)}>
              <p className="text-xs font-medium text-foreground">{t.name}</p>
              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{t.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
