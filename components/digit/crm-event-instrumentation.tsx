"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BarChart3, Users, TrendingUp, CalendarDays, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LiveChart } from "@/components/digit/live-chart"

export function CrmEventInstrumentation() {
  const [activeView, setActiveView] = useState<"funnel" | "retention">("funnel")

  const funnelData = [
    { step: "Signup", count: 1240 },
    { step: "Demo", count: 892 },
    { step: "Trial", count: 567 },
    { step: "Proposal", count: 345 },
    { step: "Closed Won", count: 218 },
  ]

  const retentionData = [
    { week: "W1", rate: 100 }, { week: "W2", rate: 72 }, { week: "W3", rate: 58 },
    { week: "W4", rate: 49 }, { week: "W5", rate: 43 }, { week: "W6", rate: 38 },
  ]

  const cohorts = [
    { name: "Jan 2024", data: [{ week: "W1", rate: 100 }, { week: "W2", rate: 74 }, { week: "W3", rate: 61 }, { week: "W4", rate: 52 }] },
    { name: "Feb 2024", data: [{ week: "W1", rate: 100 }, { week: "W2", rate: 71 }, { week: "W3", rate: 56 }, { week: "W4", rate: 47 }] },
    { name: "Mar 2024", data: [{ week: "W1", rate: 100 }, { week: "W2", rate: 78 }, { week: "W3", rate: 63 }, { week: "W4", rate: 55 }] },
  ]

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
          <div className="space-y-3">
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
            <div className="h-[250px]">
              <LiveChart data={retentionData.map((d) => ({ name: d.week, rate: d.rate }))} dataKey="rate" type="area" height={250} color="hsl(var(--chart-2))" />
            </div>
            <div className="space-y-2">
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
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
