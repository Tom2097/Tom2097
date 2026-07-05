"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"

import { Badge } from "@/components/ui/badge"
import { BarChart3, Globe, Mail, MessageSquare, Search, ExternalLink, TrendingUp, DollarSign, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LeadSource {
  source: string; leads: number; conversion: number; revenue: number; cost: number; roi: number; trend: "up" | "down" | "stable"
}

const sourceIcons: Record<string, React.ComponentType<{className?: string}>> = {
  "LinkedIn Ads": Globe, "Google Search": Search, "Email Outreach": Mail,
  "Content Marketing": BarChart3, "Referrals": MessageSquare, "Trade Shows": ExternalLink,
}

export function CrmLeadSourceRoi() {
  const [sources, setSources] = useState<LeadSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/v1/ai/crm-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "Generate lead source ROI data. Return ONLY valid JSON array. Each item: {source: string, leads: number, conversion: number (percentage), revenue: number, cost: number, roi: number (percentage), trend: \"up\"/\"down\"/\"stable\"}. Cover LinkedIn Ads, Google Search, Email Outreach, Content Marketing, Referrals, Trade Shows. No markdown.",
      }),
    }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json() })
      .then((data) => {
        const parsed = JSON.parse(data.response)
        setSources(Array.isArray(parsed) ? parsed : [])
      })
      .catch(() => setError("Could not load ROI data"))
      .finally(() => setLoading(false))
  }, [])

  const totalRevenue = sources.reduce((s, src) => s + src.revenue, 0)
  const totalCost = sources.reduce((s, src) => s + src.cost, 0)

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  if (error) return <div className="text-xs text-red-500 p-4 text-center">{error}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-emerald-500" />
          <p className="text-sm font-medium">Lead Source ROI</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">Revenue: ${(totalRevenue / 1000).toFixed(0)}K</Badge>
          <Badge variant="outline" className="text-[10px]">Total ROI: {totalCost > 0 ? ((totalRevenue - totalCost) / totalCost * 100).toFixed(0) : 0}%</Badge>
        </div>
      </div>

      {sources.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8">No lead source data yet</p>
      : <div className="space-y-2">
        {sources.map((src, i) => {
          const Icon = sourceIcons[src.source] || Globe
          return (
            <motion.div key={src.source} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="p-3 rounded-xl border border-border/50 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">{src.source}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-500">{src.roi}% ROI</span>
                  <span className={cn("text-xs", src.trend === "up" ? "text-green-500" : src.trend === "down" ? "text-red-500" : "text-muted-foreground")}>
                    {src.trend === "up" ? "↑" : src.trend === "down" ? "↓" : "→"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-1.5 rounded-lg bg-muted/30">
                  <p className="text-[10px] text-muted-foreground">Leads</p>
                  <p className="text-xs font-medium">{src.leads}</p>
                </div>
                <div className="p-1.5 rounded-lg bg-muted/30">
                  <p className="text-[10px] text-muted-foreground">Conv%</p>
                  <p className="text-xs font-medium">{src.conversion}%</p>
                </div>
                <div className="p-1.5 rounded-lg bg-muted/30">
                  <p className="text-[10px] text-muted-foreground">Revenue</p>
                  <p className="text-xs font-medium">${(src.revenue / 1000).toFixed(0)}K</p>
                </div>
                <div className="p-1.5 rounded-lg bg-muted/30">
                  <p className="text-[10px] text-muted-foreground">Cost</p>
                  <p className="text-xs font-medium">${(src.cost / 1000).toFixed(0)}K</p>
                </div>
              </div>

              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(100, (src.roi / 3000) * 100)}%` }}
                />
              </div>
            </motion.div>
          )
        })}
      </div>}
    </div>
  )
}