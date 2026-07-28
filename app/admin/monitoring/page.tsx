"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity, Clock, AlertTriangle, AlertCircle, ArrowUp, ArrowDown, Minus, Server } from "lucide-react"
import { toast } from "sonner"
import type { ObservabilitySummary, ServiceLevelIndicator } from "@/lib/observability/dashboard"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"
import { InView } from "@/components/motion-primitives/in-view"

export default function MonitoringPage() {
  const { t } = useI18n()
  const [summary, setSummary] = useState<ObservabilitySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [serviceMetrics, setServiceMetrics] = useState<{
    responseTime: Array<{ timestamp: string; value: number }>
    errorRate: Array<{ timestamp: string; value: number }>
    throughput: Array<{ timestamp: string; value: number }>
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const res = await fetch("/api/v1/admin/monitoring")
        if (!res.ok) throw new Error("Failed to load monitoring summary")
        const data = await res.json()
        if (!cancelled) setSummary(data)
      } catch {
        if (!cancelled) toast.error(t("admin.monitoring.loadSummaryFailed"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [t])

  const loadServiceMetrics = useCallback(async (serviceName: string) => {
    setSelectedService(serviceName)
    try {
      const res = await fetch(`/api/v1/admin/monitoring/metrics?service=${encodeURIComponent(serviceName)}`)
      if (!res.ok) throw new Error("Failed to load service metrics")
      const data = await res.json()
      setServiceMetrics(data)
    } catch {
      toast.error(t("admin.monitoring.loadMetricsFailed"))
    }
  }, [t])

  const getStatusColor = (status: ServiceLevelIndicator["status"]) => {
    switch (status) {
      case "healthy": return "text-green-500"
      case "warning": return "text-yellow-500"
      case "critical": return "text-red-500"
    }
  }

  const getTrendIcon = (trend: ServiceLevelIndicator["trend"]) => {
    switch (trend) {
      case "up": return <ArrowUp className="h-3 w-3 text-green-500" />
      case "down": return <ArrowDown className="h-3 w-3 text-red-500" />
      case "stable": return <Minus className="h-3 w-3 text-muted-foreground" />
    }
  }

  const maxVal = (vals: number[]) => Math.max(...vals, 1)

  return (
    <div className="space-y-6">
      <AnimatedGroup className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.monitoring.title")}</h1>
          <p className="text-muted-foreground">{t("admin.monitoring.subtitle")}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.monitoring.uptime")}</CardTitle>
              <Activity className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.uptime ?? "--"}%</div>
              <p className="text-xs text-muted-foreground">{t("admin.monitoring.last30Days")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.monitoring.avgResponseTime")}</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.avgResponseTime ?? "--"}ms</div>
              <p className="text-xs text-muted-foreground">{t("admin.monitoring.p95Latency")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.monitoring.errors")}</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.totalErrors ?? "--"}</div>
              <p className="text-xs text-muted-foreground">{t("admin.monitoring.last100Entries")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.monitoring.activeAlerts")}</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.activeAlerts ?? "--"}</div>
              <p className="text-xs text-muted-foreground">{t("admin.monitoring.requiringAttention")}</p>
            </CardContent>
          </Card>
        </div>
      </AnimatedGroup>

      <InView delay={0}>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("admin.monitoring.serviceHealth")}</CardTitle>
            <CardDescription>{t("admin.monitoring.serviceHealthDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.monitoring.service")}</TableHead>
                  <TableHead>{t("admin.monitoring.sli")}</TableHead>
                  <TableHead>{t("admin.monitoring.sloTarget")}</TableHead>
                  <TableHead>{t("admin.monitoring.status")}</TableHead>
                  <TableHead>{t("admin.monitoring.trend")}</TableHead>
                  <TableHead>{t("crm.page.tabs.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">{t("admin.monitoring.loading")}</TableCell>
                  </TableRow>
                ) : !summary || summary.services.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">{t("admin.monitoring.noServices")}</TableCell>
                  </TableRow>
                ) : (
                  summary.services.map((svc) => (
                    <TableRow key={svc.name}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-muted-foreground" />
                          {svc.name}
                        </div>
                      </TableCell>
                      <TableCell>{svc.sli}%</TableCell>
                      <TableCell>{svc.sloTarget}%</TableCell>
                      <TableCell>
                        <Badge variant={svc.status === "healthy" ? "default" : svc.status === "warning" ? "secondary" : "destructive"}>
                          <span className={`mr-1 h-2 w-2 rounded-full inline-block ${getStatusColor(svc.status)}`} />
                          {svc.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getTrendIcon(svc.trend)}
                          <span className="text-xs capitalize">{svc.trend}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          className="text-sm text-primary hover:underline"
                          onClick={() => loadServiceMetrics(svc.name)}
                        >
                          Details
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.monitoring.recentErrors")}</CardTitle>
            <CardDescription>{t("admin.monitoring.recentErrorsDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto space-y-3">
            {loading ? (
              <div className="text-center py-4 text-muted-foreground">{t("admin.monitoring.loading")}</div>
            ) : !summary || summary.recentErrors.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">{t("admin.monitoring.noRecentErrors")}</div>
            ) : (
              summary.recentErrors.map((err) => (
                <div key={err.id} className="border rounded-lg p-3 text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="destructive" className="text-[10px] px-1 py-0">{err.severity}</Badge>
                    <span className="text-[10px] text-muted-foreground">{new Date(err.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="font-medium text-xs">{err.service}</p>
                  <p className="text-xs text-muted-foreground truncate">{err.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      </InView>

      {selectedService && serviceMetrics && (
        <InView delay={0.08}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{selectedService} - 24h Metrics</span>
              <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => { setSelectedService(null); setServiceMetrics(null) }}>{t("admin.monitoring.close")}</button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="responseTime">
              <TabsList>
                <TabsTrigger value="responseTime">{t("admin.monitoring.responseTime")}</TabsTrigger>
                <TabsTrigger value="errorRate">{t("admin.monitoring.errorRate")}</TabsTrigger>
                <TabsTrigger value="throughput">{t("admin.monitoring.throughput")}</TabsTrigger>
              </TabsList>
              {(["responseTime", "errorRate", "throughput"] as const).map((metric) => (
                <TabsContent key={metric} value={metric} className="pt-4">
                  <div className="h-[200px] w-full">
                    <div className="flex items-baseline gap-[2px] h-full w-full">
                      {serviceMetrics[metric].map((point, i) => {
                        const allVals = serviceMetrics[metric].map(p => p.value)
                        const max = maxVal(allVals)
                        const height = (point.value / max) * 100
                        return (
                          <div key={i} className="flex-1 flex flex-col justify-end h-full">
                            <div
                              className="bg-primary/60 hover:bg-primary/80 rounded-t transition-all min-h-[4px]"
                              style={{ height: `${Math.max(height, 2)}%` }}
                              title={`${new Date(point.timestamp).toLocaleString()}: ${point.value}`}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>{new Date(serviceMetrics[metric][0]?.timestamp || "").toLocaleTimeString()}</span>
                    <span>{new Date(serviceMetrics[metric][serviceMetrics[metric].length - 1]?.timestamp || "").toLocaleTimeString()}</span>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
        </InView>
      )}
    </div>
  )
}
