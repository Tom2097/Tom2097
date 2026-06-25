"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingUp, DollarSign, Target, BarChart3, ArrowUp, ArrowDown, FileText, Download } from "lucide-react"
import { LiveChart } from "@/components/digit/live-chart"
import { ChartContainer } from "@/components/digit/live-chart"

const stages = [
  { name: "Lead", value: 45000, count: 12, probability: 0.2 },
  { name: "Qualified", value: 120000, count: 8, probability: 0.4 },
  { name: "Proposal", value: 280000, count: 5, probability: 0.6 },
  { name: "Negotiation", value: 350000, count: 3, probability: 0.8 },
  { name: "Won (closed)", value: 520000, count: 7, probability: 1.0 },
  { name: "Lost (closed)", value: 90000, count: 4, probability: 0 },
]

const monthlyData = [
  { month: "Jan", actual: 320000, forecast: 310000 },
  { month: "Feb", actual: 380000, forecast: 370000 },
  { month: "Mar", actual: 420000, forecast: 400000 },
  { month: "Apr", actual: 390000, forecast: 410000 },
  { month: "May", actual: 450000, forecast: 430000 },
  { month: "Jun", actual: 480000, forecast: 470000 },
]

export function CrmForecastReports() {
  const [period, setPeriod] = useState("q2")

  const totalPipeline = stages.reduce((s, st) => s + st.value, 0)
  const weightedPipeline = stages.filter(s => s.name !== "Lost (closed)").reduce((s, st) => s + st.value * st.probability, 0)
  const wonValue = stages.find(s => s.name === "Won (closed)")?.value ?? 0
  const winRate = Math.round((wonValue / (wonValue + (stages.find(s => s.name === "Lost (closed)")?.value ?? 0))) * 100)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <p className="text-sm font-medium">Forecast & Reports</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="q1">Q1 2026</SelectItem>
              <SelectItem value="q2">Q2 2026</SelectItem>
              <SelectItem value="q3">Q3 2026</SelectItem>
              <SelectItem value="q4">Q4 2026</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-8"><Download className="h-3.5 w-3.5 mr-1" />Export</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Pipeline</p>
            <p className="text-xl font-bold mt-1">${(totalPipeline / 1000).toFixed(0)}k</p>
            <div className="flex items-center gap-1 mt-1 text-xs text-green-500">
              <ArrowUp className="h-3 w-3" />12.5% vs last period
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Weighted Forecast</p>
            <p className="text-xl font-bold mt-1">${(weightedPipeline / 1000).toFixed(0)}k</p>
            <div className="flex items-center gap-1 mt-1 text-xs text-green-500">
              <ArrowUp className="h-3 w-3" />8.3% vs last period
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Win Rate</p>
            <p className="text-xl font-bold mt-1">{winRate}%</p>
            <div className="flex items-center gap-1 mt-1 text-xs text-green-500">
              <ArrowUp className="h-3 w-3" />3.2% improvement
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Avg Deal Size</p>
            <p className="text-xl font-bold mt-1">${Math.round(totalPipeline / stages.reduce((s, st) => s + st.count, 0) / 1000)}k</p>
            <div className="flex items-center gap-1 mt-1 text-xs text-red-500">
              <ArrowDown className="h-3 w-3" />2.1% vs last period
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline"><DollarSign className="h-4 w-4 mr-1" />Pipeline Value</TabsTrigger>
          <TabsTrigger value="forecast"><TrendingUp className="h-4 w-4 mr-1" />Revenue Forecast</TabsTrigger>
          <TabsTrigger value="conversion"><Target className="h-4 w-4 mr-1" />Conversion</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-4">
          <ChartContainer title="Pipeline by Stage" subtitle="Deal value distribution across stages">
            <LiveChart
              data={stages.map(s => ({ name: s.name, value: s.value }))}
              dataKey="value" type="bar" height={300} color="hsl(var(--chart-2))"
            />
          </ChartContainer>
        </TabsContent>

        <TabsContent value="forecast" className="mt-4">
          <ChartContainer title="Revenue Forecast" subtitle="Actual vs forecasted revenue">
            <LiveChart
              data={monthlyData}
              dataKey="actual" type="bar" height={300}
              color="hsl(var(--chart-2))"
            />
          </ChartContainer>
        </TabsContent>

        <TabsContent value="conversion" className="mt-4">
          <div className="rounded-xl border border-border/50 p-6">
            <h3 className="text-sm font-medium mb-4">Stage Conversion Rates</h3>
            <div className="space-y-4">
              {stages.slice(0, -1).map((stage, i) => {
                const nextStage = stages[i + 1]
                const conversionRate = stage.count > 0 ? Math.round((nextStage.count / stage.count) * 100) : 0
                return (
                  <div key={stage.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{stage.name} → {nextStage.name}</span>
                      <span>{conversionRate}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${conversionRate}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-primary" />
            Win/Loss Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-xs font-medium mb-2 text-muted-foreground">Top Win Reasons</h4>
              <div className="space-y-2">
                {[{ reason: "Product fit", pct: 40 }, { reason: "Pricing competitive", pct: 25 }, { reason: "Strong relationship", pct: 20 }, { reason: "Implementation speed", pct: 15 }].map((r) => (
                  <div key={r.reason} className="flex items-center gap-2">
                    <span className="text-xs w-28">{r.reason}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-green-500" style={{ width: `${r.pct}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-8 text-right">{r.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-medium mb-2 text-muted-foreground">Top Loss Reasons</h4>
              <div className="space-y-2">
                {[{ reason: "Budget constraints", pct: 35 }, { reason: "Competitor selected", pct: 30 }, { reason: "Decision delayed", pct: 15 }, { reason: "Feature gaps", pct: 20 }].map((r) => (
                  <div key={r.reason} className="flex items-center gap-2">
                    <span className="text-xs w-28">{r.reason}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-red-500" style={{ width: `${r.pct}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-8 text-right">{r.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
