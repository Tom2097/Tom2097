"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BarChart3, Users, TrendingUp, CalendarDays, Layers, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LiveChart } from "@/components/digit/live-chart"

interface FunnelStep {
  step: string; count: number
}

export function CrmEventInstrumentation() {
  const [funnelData, setFunnelData] = useState<FunnelStep[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/v1/ai/crm-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "Generate CRM event instrumentation data. Return ONLY valid JSON with: funnel (array of {step: string, count: number}). No markdown.",
      }),
    }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json() })
      .then((data) => {
        const parsed = JSON.parse(data.response)
        setFunnelData(parsed.funnel ?? [])
      })
      .catch(() => setError("Could not load event data"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  if (error) return <div className="text-xs text-red-500 p-4 text-center">{error}</div>

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <BarChart3 className="h-4 w-4 text-primary" />
            Event Instrumentation
            <Badge variant="secondary" className="text-[10px]">Analytics</Badge>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="default" className="h-7 text-[10px]" disabled>
              <Layers className="h-3 w-3 mr-1" />Funnel
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[10px]"
              disabled
              title="Retention/cohort analytics are not available yet in this environment."
            >
              <CalendarDays className="h-3 w-3 mr-1" />Retention
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {funnelData.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8">No funnel data</p>
        : <div className="space-y-3">
          <div className="h-[250px]">
            <LiveChart data={funnelData.map((d) => ({ name: d.step, count: d.count }))} dataKey="count" type="bar" color="hsl(var(--chart-2))" />
          </div>
          <div className="space-y-1.5">
            {funnelData.map((step, i) => (
              <div key={step.step} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{i + 1}</div>
                <p className="text-xs flex-1">{step.step}</p>
                <p className="text-xs font-medium">{step.count}</p>
                <p className="text-[10px] text-muted-foreground w-12 text-right">
                  {i > 0 ? `${Math.round((step.count / funnelData[i - 1].count) * 100)}%` : "100%"}
                </p>
              </div>
            ))}
          </div>
        </div>}
      </CardContent>
    </Card>
  )
}