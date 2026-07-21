"use client"

import { useState, useEffect, useCallback } from "react"
import { Mail, Phone, Sparkles, ArrowRight, Star, Clock, MoreHorizontal, UserPlus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface Lead {
  id: string
  name: string
  email: string | null
  phone: string | null
  title: string | null
  company: string | null
  score: number
  status: string
  created_at: string
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-500"
  if (score >= 60) return "text-amber-500"
  return "text-muted-foreground"
}

function getScoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-500/10"
  if (score >= 60) return "bg-amber-500/10"
  return "bg-muted"
}

export function CrmLeadInbox() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<"score" | "recent">("score")

  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [title, setTitle] = useState("")

  const loadLeads = useCallback(() => {
    setLoading(true)
    setError("")
    Promise.all([
      fetch("/api/v1/crm/contacts?status=lead").then((r) => (r.ok ? r.json() : Promise.reject("Failed"))),
      // Real, persisted lead scores (computed by computeLeadScore) -- the plain contacts
      // query has no score column, so this is the only place a real score comes from.
      fetch("/api/v1/crm/leads/scores")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ])
      .then(([data, scores]) => {
        const scoreList = Array.isArray(scores) ? scores : []
        const scoreMap = new Map<string, number>(
          scoreList
            .filter((s): s is { contact_id: string; score: number } => !!s && typeof s.contact_id === "string" && typeof s.score === "number")
            .map((s) => [s.contact_id, s.score]),
        )
        const items = (data.contacts || data.data || []).map((c: unknown) => {
          const contact = c as {
            id: string
            first_name?: string
            last_name?: string
            name?: string
            email?: string
            phone?: string
            title?: string
            status?: string
            company?: string
            company_name?: string
            created_at?: string
          }
          return {
            id: contact.id,
            name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || contact.name || contact.email || "Unknown",
            email: contact.email || null,
            phone: contact.phone || null,
            title: contact.title || null,
            company: contact.company || contact.company_name || null,
            score: scoreMap.get(contact.id) ?? 0,
            status: contact.status || "lead",
            created_at: contact.created_at || new Date().toISOString(),
          }
        })
        setLeads(items)
      })
      .catch(() => setError("Failed to load leads"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const load = async () => {
      await loadLeads()
    }
    load()
  }, [loadLeads])

  const resetForm = () => {
    setFirstName("")
    setLastName("")
    setEmail("")
    setPhone("")
    setTitle("")
    setFormError(null)
  }

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const res = await fetch("/api/v1/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: email || null,
          phone: phone || null,
          title: title || null,
          status: "lead",
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to create lead")
      }
      setAddOpen(false)
      resetForm()
      loadLeads()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const filtered = leads
    .filter((l) => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.company?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortBy === "score" ? b.score - a.score : new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  if (loading) return <div className="text-xs text-muted-foreground p-4 text-center">Loading leads...</div>
  if (error) return <div className="text-xs text-red-500 p-4 text-center">{error}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <div className="flex rounded-lg border border-border/50 p-0.5 bg-secondary/30">
            <button
              onClick={() => setSortBy("score")}
              className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", sortBy === "score" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
            >
              <Sparkles className="w-3 h-3 inline mr-1" />Score
            </button>
            <button
              onClick={() => setSortBy("recent")}
              className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", sortBy === "recent" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
            >
              <Clock className="w-3 h-3 inline mr-1" />Recent
            </button>
          </div>
        </div>
        <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetForm() }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><UserPlus className="w-4 h-4" /> Add Lead</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Lead</DialogTitle>
              <DialogDescription>Add a new lead to your inbox.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddLead}>
              <div className="grid gap-4 py-4">
                {formError && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{formError}</div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lead-first-name">First name</Label>
                    <Input id="lead-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lead-last-name">Last name</Label>
                    <Input id="lead-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-email">Email</Label>
                  <Input id="lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@company.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-phone">Phone</Label>
                  <Input id="lead-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-title">Title</Label>
                  <Input id="lead-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Software Engineer" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setAddOpen(false); resetForm() }}>Cancel</Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Lead
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {filtered.map((lead) => (
          <Card key={lead.id} className="p-4 border-border/50 hover:border-primary/30 transition-all cursor-pointer group">
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold", getScoreBg(lead.score), getScoreColor(lead.score))}>
                  {lead.score}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{lead.name}</p>
                    {lead.score >= 80 && <Star className="w-3 h-3 fill-amber-500 text-amber-500" />}
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 capitalize">{lead.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{lead.title ? `${lead.title} at ${lead.company}` : lead.company || ""}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    {lead.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>}
                    {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => lead.email && (window.location.href = `mailto:${lead.email}`)}><Mail className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => lead.phone && (window.location.href = `tel:${lead.phone}`)}><Phone className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fetch("/api/v1/crm/contacts", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: lead.id, status: "qualified" }),
                }).catch(() => {})}><ArrowRight className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fetch("/api/v1/crm/contacts", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: lead.id }),
                }).catch(() => {})}><MoreHorizontal className="w-4 h-4" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
