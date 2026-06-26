"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Users, Building2, DollarSign, ArrowUp, ArrowDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface VerticalData {
  name: string; deals: number; value: number; growth: number
  signals: string[]; trend: "up" | "down"
}

export function CrmVerticalSignals() {
  const [verticals, setVerticals] = useState<VerticalData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/v1/ai/crm-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "Analyze CRM pipeline by vertical industry. Return ONLY valid JSON array. Each item: {name: string (industry name), deals: number, value: number, growth: number, signals: string[], trend: \"up\"/\"down\"}. No markdown.",
      }),
    }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json() })
      .then((data) => {
        const parsed = JSON.parse(data.response)
        setVerticals(Array.isArray(parsed) ? parsed : [])
      })
      .catch(() => setError("Could not load vertical signals"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  if (error) return <div className="text-xs text-red-500 p-4 text-center">{error}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          <p className="text-sm font-medium">Vertical Buying Signals</p>
        </div>
        <Badge variant="secondary" className="text-[10px]">Market intelligence</Badge>
      </div>

      {verticals.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8">No vertical data yet</p>
      : <div className="space-y-2">
        {verticals.map((v, i) => (
          <motion.div key={v.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
            className="p-3 rounded-xl border border-border/50 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">{v.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">${v.value.toLocaleString()}</span>
                <div className={cn("flex items-center gap-0.5 text-xs font-medium", v.trend === "up" ? "text-green-500" : "text-red-500")}>
                  {v.trend === "up" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {Math.abs(v.growth)}%
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{v.deals} deals</span>
              <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />${v.deals > 0 ? (v.value / v.deals / 1000).toFixed(0) : 0}K avg</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {v.signals.map((s) => (
                <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
              ))}
            </div>
          </motion.div>
        ))}
      </div>}
    </div>
  )
}