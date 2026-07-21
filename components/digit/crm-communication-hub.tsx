"use client"

import { useState, useEffect } from "react"
import { Send, Mail, MessageSquare, Phone, FileText, Plus, ChevronDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { COMMUNICATION_CHANNELS } from "@/lib/crm/types"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface CommMessage {
  id: string; channel: string; direction: string; subject: string; body: string; to: string; from: string; timestamp: string
}

interface CommTemplate {
  id: string; name: string; subject: string; body: string; channel: string
}

export function CrmCommunicationHub() {
  const [messages, setMessages] = useState<CommMessage[]>([])
  const [templates, setTemplates] = useState<CommTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [channel, setChannel] = useState<string>("email")
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [showCompose, setShowCompose] = useState(false)

  const [newTemplateOpen, setNewTemplateOpen] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState("")
  const [newTemplateChannel, setNewTemplateChannel] = useState<string>("email")
  const [newTemplateSubject, setNewTemplateSubject] = useState("")
  const [newTemplateBody, setNewTemplateBody] = useState("")
  const [creatingTemplate, setCreatingTemplate] = useState(false)

  const fetchData = async () => {
    try {
      const [msgRes, tmplRes] = await Promise.all([
        fetch("/api/v1/crm/communications"),
        fetch("/api/v1/crm/templates"),
      ])
      if (!msgRes.ok || !tmplRes.ok) throw new Error("Failed")
      const msgData = await msgRes.json()
      const tmplData = await tmplRes.json()
      setMessages(msgData.communications ?? msgData ?? [])
      setTemplates(tmplData.templates ?? tmplData ?? [])
    } catch {
      setError("Could not load communications")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch("/api/v1/crm/communications").then((r) => r.ok ? r.json() : Promise.reject()).then((msgData) => {
      setMessages(msgData.communications ?? msgData ?? [])
      return fetch("/api/v1/crm/templates").then((r) => r.ok ? r.json() : Promise.reject())
    }).then((tmplData) => {
      setTemplates(tmplData.templates ?? tmplData ?? [])
    }).catch(() => setError("Could not load communications"))
  }, [])

  const resetTemplateForm = () => {
    setNewTemplateName("")
    setNewTemplateChannel("email")
    setNewTemplateSubject("")
    setNewTemplateBody("")
  }

  const createTemplate = async () => {
    if (!newTemplateName.trim() || !newTemplateSubject.trim() || !newTemplateBody.trim()) return
    setCreatingTemplate(true)
    try {
      const res = await fetch("/api/v1/crm/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTemplateName.trim(),
          channel: newTemplateChannel,
          subject: newTemplateSubject.trim(),
          body: newTemplateBody,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to create template")
      }
      await fetchData()
      toast.success("Template created")
      setNewTemplateOpen(false)
      resetTemplateForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create template")
    } finally {
      setCreatingTemplate(false)
    }
  }

  const applyTemplate = (t: CommTemplate) => {
    setSubject(t.subject)
    setBody(t.body)
  }

  const sendMessage = async () => {
    if (!to || !subject || !body) return
    setSending(true)
    try {
      const res = await fetch("/api/v1/crm/communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, to_address: to, subject, body }),
      })
      if (!res.ok) throw new Error("Failed")
      await fetchData()
      setShowCompose(false)
      setTo(""); setSubject(""); setBody("")
    } catch {
      setError("Failed to send")
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  if (error) return <div className="text-xs text-red-500 p-4 text-center">{error} <button onClick={fetchData} className="underline ml-1">Retry</button></div>

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
              <Select onValueChange={(v) => applyTemplate(templates.find((t) => t.name === v) as CommTemplate)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Use template..." /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => <SelectItem key={t.id} value={t.name} className="text-xs">{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Input placeholder="To: email or phone" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 text-sm" />
              <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-8 text-sm" />
              <Textarea placeholder="Write your message..." value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="text-sm" />
            </div>
            <Button className="gap-1" onClick={sendMessage} disabled={sending}>
              {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Send via {channel}
            </Button>
          </Card>
        )}

        <div className="space-y-2">
          {messages.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No conversations yet</p>}
          {messages.map((msg) => (
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
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Templates</h3>
          <Dialog open={newTemplateOpen} onOpenChange={(open) => { setNewTemplateOpen(open); if (!open) resetTemplateForm() }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
                <Plus className="w-3 h-3" /> New
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>New Template</DialogTitle>
                <DialogDescription>Create a reusable communication template.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Name</Label>
                  <Input id="template-name" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="Welcome email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-channel">Channel</Label>
                  <Select value={newTemplateChannel} onValueChange={setNewTemplateChannel}>
                    <SelectTrigger id="template-channel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMUNICATION_CHANNELS.map((c) => (
                        <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-subject">Subject</Label>
                  <Input id="template-subject" value={newTemplateSubject} onChange={(e) => setNewTemplateSubject(e.target.value)} placeholder="Welcome to {{company}}!" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-body">Body</Label>
                  <Textarea id="template-body" value={newTemplateBody} onChange={(e) => setNewTemplateBody(e.target.value)} rows={5} placeholder="Write your template content..." />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setNewTemplateOpen(false); resetTemplateForm() }}>Cancel</Button>
                <Button onClick={createTemplate} disabled={creatingTemplate || !newTemplateName.trim() || !newTemplateSubject.trim() || !newTemplateBody.trim()}>
                  {creatingTemplate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Template
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {templates.length === 0 && <p className="text-xs text-muted-foreground">No templates yet</p>}
        <div className="space-y-2">
          {templates.map((t) => (
            <Card key={t.id} className="p-3 border-border/50 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => applyTemplate(t)}>
              <p className="text-xs font-medium text-foreground">{t.name}</p>
              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{t.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}