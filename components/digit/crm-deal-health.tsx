"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, CheckCircle2, Clock, TrendingUp, Zap, MessageSquare, Users, Target, Loader2 } from "lucide-react"

interface DealHealthItem {
  id: string; deal: string; value: number; stage: string; risk: "high" | "medium" | "low"
  reason: string; nextAction: string; daysSinceUpdate: number
}

const riskColors = { high: "text-red-500 bg-red-500/10", medium: "text-amber-500 bg-amber-500/10", low: "text-green-500 bg-green-500/10" }

export function CrmDealHealthRadar() {
  const [deals, setDeals] = useState<DealHealthItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchHealth = async () => {
    try {
      const res = await fetch("/api/v1/ai/crm-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "Analyze my CRM pipeline and return 5 deals with their health status. Return ONLY valid JSON array with objects having: id (string), deal (string), value (number), stage (string), risk (\"high\"/\"medium\"/\"low\"), reason (string), nextAction (string), daysSinceUpdate (number). No markdown.",
        }),
      })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      const parsed = JSON.parse(data.response)
      setDeals(Array.isArray(parsed) ? parsed : [])
    } catch {
      setError("Could not load deal health")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch("/api/v1/ai/crm-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "Analyze my CRM pipeline and return 5 deals with their health status. Return ONLY valid JSON array with objects having: id (string), deal (string), value (number), stage (string), risk (\"high\"/\"medium\"/\"low\"), reason (string), nextAction (string), daysSinceUpdate (number). No markdown.",
      }),
    }).then((r) => r.ok ? r.json() : Promise.reject()).then((data) => {
      const parsed = JSON.parse(data.response)
      setDeals(Array.isArray(parsed) ? parsed : [])
    }).catch(() => setError("Could not load deal health"))
  }, [])

  const highRisk = deals.filter((d) => d.risk === "high").length
  const mediumRisk = deals.filter((d) => d.risk === "medium").length

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  if (error) return <div className="text-xs text-red-500 p-4 text-center">{error} <button onClick={fetchHealth} className="underline ml-1">Retry</button></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <p className="text-sm font-medium">Deal Health Radar</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] text-red-500 border-red-500/30">{highRisk} at risk</Badge>
          <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">{mediumRisk} watching</Badge>
        </div>
      </div>

      <div className="space-y-2">
        {deals.map((deal, i) => (
          <motion.div
            key={deal.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-3 rounded-xl border border-border/50 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{deal.deal}</p>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${riskColors[deal.risk]}`}>
                    {deal.risk === "high" ? "At Risk" : deal.risk === "medium" ? "Watch" : "Healthy"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">${deal.value.toLocaleString()} · {deal.stage}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <AlertTriangle className={`h-3 w-3 ${deal.risk === "high" ? "text-red-500" : "text-amber-500"}`} />
              <span>{deal.reason}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {deal.daysSinceUpdate} days since last activity
              </div>
              <Button size="sm" variant="ghost" className="h-6 text-[10px]">
                <Target className="h-3 w-3 mr-1" />{deal.nextAction}
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}