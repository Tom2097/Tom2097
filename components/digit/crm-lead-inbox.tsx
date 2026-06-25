"use client"

import { useState } from "react"
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

const mockLeads: Lead[] = [
  { id: "1", name: "Rahul Sharma", email: "rahul@techcorp.com", phone: "+91 98765 43210", title: "CTO", company: "TechCorp India", score: 92, status: "lead", created_at: new Date().toISOString() },
  { id: "2", name: "Priya Patel", email: "priya@greenenergy.in", phone: "+91 87654 32109", title: "VP Engineering", company: "GreenEnergy Solutions", score: 88, status: "lead", created_at: new Date().toISOString() },
  { id: "3", name: "Amit Singh", email: "amit@pharmalabs.com", phone: "+91 76543 21098", title: "Quality Head", company: "PharmaLabs Ltd", score: 75, status: "lead", created_at: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: "4", name: "Sneha Reddy", email: "sneha@logistics.in", phone: "+91 65432 10987", title: "Operations Director", company: "FastTrack Logistics", score: 62, status: "lead", created_at: new Date(Date.now() - 10 * 86400000).toISOString() },
  { id: "5", name: "Vikram Joshi", email: "vikram@fintech.com", phone: "+91 54321 09876", title: "Analyst", company: "FinTech Ventures", score: 45, status: "lead", created_at: new Date(Date.now() - 20 * 86400000).toISOString() },
]

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
  const [leads] = useState(mockLeads)
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<"score" | "recent">("score")

  const filtered = leads
    .filter((l) => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.company?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortBy === "score" ? b.score - a.score : new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

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
                  <p className="text-sm text-muted-foreground">{lead.title} at {lead.company}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    {lead.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>}
                    {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8"><Mail className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><Phone className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowRight className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
