"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Plus, GripVertical, DollarSign, Calendar, User, Tag, X, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Deal {
  id: string; title: string; value: number; stage: string; probability: number
  currency: string; expected_close_date: string | null; tags: string[]
  owner_id: string | null; company_id: string | null; contact_id: string | null
  description: string | null
}

const STAGES = [
  { key: "lead", label: "Lead", color: "bg-gray-500" },
  { key: "qualified", label: "Qualified", color: "bg-blue-500" },
  { key: "proposal", label: "Proposal", color: "bg-amber-500" },
  { key: "negotiation", label: "Negotiation", color: "bg-orange-500" },
  { key: "won", label: "Won", color: "bg-green-500" },
  { key: "lost", label: "Lost", color: "bg-red-500" },
]

export function CrmPipelineBoard() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [newDealOpen, setNewDealOpen] = useState(false)
  const [newDealStage, setNewDealStage] = useState("lead")
  const [newTitle, setNewTitle] = useState("")
  const [newValue, setNewValue] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/v1/crm/deals")
        if (res.ok) { const json = await res.json(); setDeals(json.deals ?? []) }
      } catch {} finally { setLoading(false) }
    }
    load()
  }, [])

  const grouped = STAGES.map((s) => ({
    ...s,
    deals: deals.filter((d) => d.stage === s.key),
    total: deals.filter((d) => d.stage === s.key).reduce((sum, d) => sum + d.value, 0),
  }))

  const handleDrop = async (dealId: string, targetStage: string) => {
    setDraggingId(null)
    const deal = deals.find((d) => d.id === dealId)
    if (!deal || deal.stage === targetStage) return

    const previousStage = deal.stage
    setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, stage: targetStage } : d))

    try {
      const res = await fetch(`/api/v1/crm/deals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dealId, stage: targetStage }),
      })
      if (!res.ok) throw new Error("Failed to update deal stage")
    } catch {
      setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, stage: previousStage } : d))
      toast.error("Failed to move deal — please try again")
    }
  }

  const addDeal = async () => {
    if (!newTitle.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/v1/crm/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), value: parseFloat(newValue) || 0, stage: newDealStage }),
      })
      if (res.ok) {
        const json = await res.json()
        setDeals((prev) => [...prev, json.deal])
        setNewTitle(""); setNewValue(""); setNewDealOpen(false)
      }
    } catch {} finally { setSaving(false) }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground text-sm">Loading pipeline...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{deals.length} deals across {STAGES.length} stages</p>
        <Button size="sm" onClick={() => { setNewDealOpen(true); setNewDealStage("lead") }}>
          <Plus className="h-4 w-4 mr-1" />Add Deal
        </Button>
      </div>

      <div className="grid grid-cols-6 gap-3 min-h-[500px]">
        {grouped.map((stage) => (
          <div
            key={stage.key}
            className="rounded-xl bg-muted/30 border border-border/50 p-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("dealId")
              if (id) handleDrop(id, stage.key)
            }}
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                <span className="text-xs font-medium">{stage.label}</span>
                <Badge variant="secondary" className="text-[10px] ml-1">{stage.deals.length}</Badge>
              </div>
            </div>

            <div className="space-y-2">
                  <AnimatePresence>
                {stage.deals.map((deal) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggingId(deal.id)
                      e.dataTransfer.setData("dealId", deal.id)
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className={`p-2.5 rounded-lg bg-card border border-border/50 cursor-grab active:cursor-grabbing hover:border-primary/30 transition-all animate-in fade-in slide-in-from-bottom-1 ${draggingId === deal.id ? "opacity-50" : ""}`}
                  >
                    <p className="text-xs font-medium truncate">{deal.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><DollarSign className="h-3 w-3" />{deal.value?.toLocaleString()}</span>
                      <span className="flex items-center gap-0.5"><Tag className="h-3 w-3" />{deal.probability}%</span>
                    </div>
                    {deal.expected_close_date && (
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-0.5">
                        <Calendar className="h-3 w-3" />{new Date(deal.expected_close_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </AnimatePresence>

              {stage.deals.length === 0 && (
                <div className="p-4 text-center text-[10px] text-muted-foreground border border-dashed border-border/50 rounded-lg">
                  Drop deals here
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {newDealOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setNewDealOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="bg-card rounded-xl p-6 w-full max-w-md space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">New Deal</h3>
                <Button variant="ghost" size="icon" onClick={() => setNewDealOpen(false)}><X className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-3">
                <Input placeholder="Deal title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                <Input placeholder="Value" type="number" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
                <div className="flex gap-2">
                  {STAGES.filter(s => s.key !== "won" && s.key !== "lost").map((s) => (
                    <Button key={s.key} size="sm" variant={newDealStage === s.key ? "default" : "outline"} onClick={() => setNewDealStage(s.key)}>
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setNewDealOpen(false)}>Cancel</Button>
                <Button onClick={addDeal} disabled={!newTitle.trim() || saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Create Deal
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
