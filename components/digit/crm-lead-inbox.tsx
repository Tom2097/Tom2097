"use client"

import { useState, useEffect } from "react"
import { Mail, Phone, Sparkles, ArrowRight, Star, Clock, MoreHorizontal, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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

  useEffect(() => {
    fetch("/api/v1/crm/contacts?status=lead")
      .then((r) => r.ok ? r.json() : Promise.reject("Failed"))
      .then((data) => {
        const items = (data.contacts || data.data || []).map((c: any) => ({
          id: c.id,
          name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.name || c.email || "Unknown",
          email: c.email || null,
          phone: c.phone || null,
          title: c.title || null,
          company: c.company || c.company_name || null,
          score: c.score || c.lead_score || 0,
          status: c.status || "lead",
          created_at: c.created_at || new Date().toISOString(),
        }))
        setLeads(items)
        setLoading(false)
      })
      .catch(() => { setError("Failed to load leads"); setLoading(false) })
  }, [])

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
        <Button size="sm" className="gap-1"><UserPlus className="w-4 h-4" /> Add Lead</Button>
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