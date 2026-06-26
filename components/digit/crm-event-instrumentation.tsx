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

interface RetentionPoint {
  week: string; rate: number
}

interface CohortData {
  name: string; data: RetentionPoint[]
}

export function CrmEventInstrumentation() {
  const [activeView, setActiveView] = useState<"funnel" | "retention">("funnel")
  const [funnelData, setFunnelData] = useState<FunnelStep[]>([])
  const [retentionData, setRetentionData] = useState<RetentionPoint[]>([])
  const [cohorts, setCohorts] = useState<CohortData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    setLoading(true)
    setError("")
    fetch("/api/v1/ai/crm-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "Generate CRM event instrumentation data. Return ONLY valid JSON with: funnel (array of {step: string, count: number}), retention (array of {week: string, rate: number}), cohorts (array of {name: string, data: [{week: string, rate: number}]}). No markdown.",
      }),
    }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json() })
      .then((data) => {
        const parsed = JSON.parse(data.response)
        setFunnelData(parsed.funnel ?? [])
        setRetentionData(parsed.retention ?? [])
        setCohorts(parsed.cohorts ?? [])
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
            <Button size="sm" variant={activeView === "funnel" ? "default" : "ghost"} className="h-7 text-[10px]" onClick={() => setActiveView("funnel")}>
              <Layers className="h-3 w-3 mr-1" />Funnel
            </Button>
            <Button size="sm" variant={activeView === "retention" ? "default" : "ghost"} className="h-7 text-[10px]" onClick={() => setActiveView("retention")}>
              <CalendarDays className="h-3 w-3 mr-1" />Retention
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {activeView === "funnel" ? (
          funnelData.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8">No funnel data</p>
          : <div className="space-y-3">
            <div className="h-[250px]">
              <LiveChart data={funnelData.map((d) => ({ name: d.step, count: d.count }))} dataKey="count" type="bar" height={250} color="hsl(var(--chart-2))" />
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
          </div>
        ) : (
          <div className="space-y-4">
            {retentionData.length > 0 && <div className="h-[250px]">
              <LiveChart data={retentionData.map((d) => ({ name: d.week, rate: d.rate }))} dataKey="rate" type="area" height={250} color="hsl(var(--chart-2))" />
            </div>}
            {cohorts.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">No cohort data</p>
            : <div className="space-y-2">
              {cohorts.map((cohort) => (
                <div key={cohort.name} className="p-2 rounded-lg border border-border/50">
                  <p className="text-xs font-medium mb-2">{cohort.name} Cohort</p>
                  <div className="flex gap-1">
                    {cohort.data.map((d) => (
                      <div key={d.week} className="flex-1 text-center p-1 rounded"
                        style={{ backgroundColor: `hsl(var(--chart-2) / ${d.rate / 100})` }}
                      >
                        <p className="text-[10px] font-bold">{d.rate}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}