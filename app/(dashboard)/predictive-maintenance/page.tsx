"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, CheckCircle2, Info, Activity, BarChart3, Clock, Plus, Wrench, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface RULEstimate {
  assetId: string
  assetName: string
  estimatedRulDays: number
  confidenceLevel: "high" | "medium" | "low"
  remainingCycles?: number
  recommendedAction: "monitor" | "inspect" | "maintain" | "replace"
  failureProbability: number
  nextMaintenanceDate: string
}

interface MaintenanceAlert {
  assetId: string
  assetName: string
  alertType: "anomaly" | "threshold_breach" | "degradation" | "predictive"
  severity: "info" | "warning" | "critical"
  message: string
  timestamp: string
  acknowledged: boolean
}

export default function PredictiveMaintenancePage() {
  const [schedule, setSchedule] = useState<RULEstimate[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  const [assetId, setAssetId] = useState("")
  const [assetRules, setAssetRules] = useState<{ rul: RULEstimate | null; alerts: MaintenanceAlert[] } | null>(null)
  const [assetLoading, setAssetLoading] = useState(false)

  const [simForm, setSimForm] = useState({
    assetId: "",
    temperature: "",
    vibration: "",
    pressure: "",
    rpm: "",
    powerConsumption: "",
    humidity: "",
  })
  const [simSending, setSimSending] = useState(false)

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/predictive/rul")
      const data = await res.json()
      if (res.ok) {
        setSchedule(data.schedule || [])
      }
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch("/api/v1/predictive/rul")
        const data = await res.json()
        if (res.ok && !cancelled) {
          setSchedule(data.schedule || [])
        } else if (!cancelled) {
          toast.error(data.error || "Failed to load schedule")
        }
      } catch {
        if (!cancelled) toast.error("Failed to load maintenance schedule")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const handleLookupAsset = async () => {
    if (!assetId.trim()) {
      toast.error("Please enter an asset ID")
      return
    }
    try {
      setAssetLoading(true)
      const res = await fetch(`/api/v1/predictive/rul?assetId=${encodeURIComponent(assetId)}`)
      const data = await res.json()
      if (res.ok) {
        setAssetRules(data)
      } else {
        toast.error(data.error || "Failed to look up asset")
      }
    } catch {
      toast.error("Failed to look up asset")
    } finally {
      setAssetLoading(false)
    }
  }

  const handleSimulateTelemetry = async () => {
    const reading: Record<string, unknown> = {
      assetId: simForm.assetId,
      timestamp: new Date().toISOString(),
    }
    if (simForm.temperature) reading.temperature = parseFloat(simForm.temperature)
    if (simForm.vibration) reading.vibration = parseFloat(simForm.vibration)
    if (simForm.pressure) reading.pressure = parseFloat(simForm.pressure)
    if (simForm.rpm) reading.rpm = parseFloat(simForm.rpm)
    if (simForm.powerConsumption) reading.powerConsumption = parseFloat(simForm.powerConsumption)
    if (simForm.humidity) reading.humidity = parseFloat(simForm.humidity)

    try {
      setSimSending(true)
      const res = await fetch("/api/v1/predictive/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reading),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Telemetry ingested successfully")
        setSimForm({
          assetId: simForm.assetId,
          temperature: "",
          vibration: "",
          pressure: "",
          rpm: "",
          powerConsumption: "",
          humidity: "",
        })
        fetchSchedule()
      } else {
        toast.error(data.error || "Failed to ingest telemetry")
      }
    } catch {
      toast.error("Failed to ingest telemetry")
    } finally {
      setSimSending(false)
    }
  }

  const dueSoon = schedule.filter(a => a.estimatedRulDays <= 30 && a.estimatedRulDays > 0)
  const overdue = schedule.filter(a => a.estimatedRulDays === 0)
  const healthy = schedule.filter(a => a.estimatedRulDays > 90)
  const critical = schedule.filter(a => a.failureProbability > 0.7)

  const severityColor = (s: string) => {
    switch (s) {
      case "critical": return "text-red-500"
      case "warning": return "text-amber-500"
      case "info": return "text-blue-500"
      default: return "text-muted-foreground"
    }
  }

  const confidenceColor = (c: string) => {
    switch (c) {
      case "high": return "text-emerald-500"
      case "medium": return "text-amber-500"
      case "low": return "text-red-500"
      default: return "text-muted-foreground"
    }
  }

  const actionBadge = (action: string) => {
    switch (action) {
      case "replace": return <Badge variant="destructive">Replace</Badge>
      case "maintain": return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20">Maintain</Badge>
      case "inspect": return <Badge variant="secondary">Inspect</Badge>
      case "monitor": return <Badge variant="outline">Monitor</Badge>
      default: return <Badge variant="outline">{action}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-500">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Predictive Maintenance</h1>
            <p className="text-sm text-muted-foreground">RUL estimates, anomaly detection, and maintenance scheduling</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-3xl font-bold text-red-500">{overdue.length}</p>
            <p className="text-xs text-muted-foreground">Assets past due date</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-amber-500" />
              Due Soon
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-3xl font-bold text-amber-500">{dueSoon.length}</p>
            <p className="text-xs text-muted-foreground">&le;30 days remaining</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wrench className="h-4 w-4 text-amber-500" />
              Needs Action
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-3xl font-bold text-amber-500">{critical.length}</p>
            <p className="text-xs text-muted-foreground">High failure probability</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Healthy
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-3xl font-bold text-emerald-500">{healthy.length}</p>
            <p className="text-xs text-muted-foreground">&gt;90 days remaining</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="lookup" className="gap-2">
            <Info className="h-4 w-4" />
            Asset Lookup
          </TabsTrigger>
          <TabsTrigger value="simulator" className="gap-2">
            <Plus className="h-4 w-4" />
            Telemetry Simulator
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Schedule</CardTitle>
              <CardDescription>All assets ordered by remaining useful life</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">Loading...</div>
              ) : schedule.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  No assets found. Ingest telemetry data to generate RUL estimates.
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asset</TableHead>
                        <TableHead>RUL (days)</TableHead>
                        <TableHead>Failure Probability</TableHead>
                        <TableHead>Confidence</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Next Maintenance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedule.map((asset) => (
                        <TableRow key={asset.assetId}>
                          <TableCell className="font-medium">{asset.assetName}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={
                                asset.estimatedRulDays === 0 ? "text-red-500 font-bold" :
                                asset.estimatedRulDays <= 30 ? "text-amber-500" :
                                "text-muted-foreground"
                              }>
                                {asset.estimatedRulDays === 0 ? "OVERDUE" : asset.estimatedRulDays}
                              </span>
                              {asset.estimatedRulDays > 0 && (
                                <Progress
                                  value={Math.min(100, (1 - asset.estimatedRulDays / 365) * 100)}
                                  className="w-16 h-2"
                                />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={asset.failureProbability > 0.7 ? "text-red-500" : asset.failureProbability > 0.3 ? "text-amber-500" : ""}>
                              {(asset.failureProbability * 100).toFixed(0)}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={confidenceColor(asset.confidenceLevel)}>
                              {asset.confidenceLevel.charAt(0).toUpperCase() + asset.confidenceLevel.slice(1)}
                            </span>
                          </TableCell>
                          <TableCell>{actionBadge(asset.recommendedAction)}</TableCell>
                          <TableCell className="text-sm">{asset.nextMaintenanceDate}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lookup" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Asset Lookup</CardTitle>
              <CardDescription>View RUL estimate and recent alerts for a specific asset</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter asset ID..."
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  className="max-w-sm"
                />
                <Button onClick={handleLookupAsset} disabled={assetLoading}>
                  {assetLoading ? "Loading..." : "Look Up"}
                </Button>
              </div>

              {assetRules && (
                <div className="space-y-4">
                  {assetRules.rul && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{assetRules.rul.assetName}</CardTitle>
                        <CardDescription>RUL Estimate</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Remaining Life</p>
                            <p className="text-2xl font-bold">{assetRules.rul.estimatedRulDays} <span className="text-sm font-normal text-muted-foreground">days</span></p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Failure Probability</p>
                            <p className="text-2xl font-bold">{(assetRules.rul.failureProbability * 100).toFixed(0)}%</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Confidence</p>
                            <p className="text-2xl font-bold capitalize">{assetRules.rul.confidenceLevel}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Recommended Action</p>
                            <p className="text-2xl font-bold">{actionBadge(assetRules.rul.recommendedAction)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle>Alerts</CardTitle>
                      <CardDescription>Recent anomaly detections for this asset</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {assetRules.alerts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No anomalies detected in the last 24 hours.</p>
                      ) : (
                        <div className="space-y-2">
                          {assetRules.alerts.map((alert, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-3 p-3 rounded-lg border"
                            >
                              <div className={`mt-0.5 ${severityColor(alert.severity)}`}>
                                {alert.severity === "critical" ? <AlertCircle className="h-4 w-4" /> :
                                 alert.severity === "warning" ? <AlertTriangle className="h-4 w-4" /> :
                                 <Info className="h-4 w-4" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium capitalize">{alert.alertType.replace(/_/g, " ")}</span>
                                  <Badge variant="secondary" className="text-[10px] capitalize">{alert.severity}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                                <p className="text-xs text-muted-foreground mt-1">{new Date(alert.timestamp).toLocaleString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simulator" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Telemetry Simulator</CardTitle>
              <CardDescription>Inject test telemetry data to simulate sensor readings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="sim-asset-id">Asset ID *</Label>
                  <Input
                    id="sim-asset-id"
                    value={simForm.assetId}
                    onChange={(e) => setSimForm({ ...simForm, assetId: e.target.value })}
                    placeholder="asset-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sim-temp">Temperature (°C)</Label>
                  <Input
                    id="sim-temp"
                    type="number"
                    value={simForm.temperature}
                    onChange={(e) => setSimForm({ ...simForm, temperature: e.target.value })}
                    placeholder="e.g. 75"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sim-vibe">Vibration (mm/s)</Label>
                  <Input
                    id="sim-vibe"
                    type="number"
                    value={simForm.vibration}
                    onChange={(e) => setSimForm({ ...simForm, vibration: e.target.value })}
                    placeholder="e.g. 12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sim-pressure">Pressure (bar)</Label>
                  <Input
                    id="sim-pressure"
                    type="number"
                    value={simForm.pressure}
                    onChange={(e) => setSimForm({ ...simForm, pressure: e.target.value })}
                    placeholder="e.g. 100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sim-rpm">RPM</Label>
                  <Input
                    id="sim-rpm"
                    type="number"
                    value={simForm.rpm}
                    onChange={(e) => setSimForm({ ...simForm, rpm: e.target.value })}
                    placeholder="e.g. 1500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sim-power">Power Consumption (kW)</Label>
                  <Input
                    id="sim-power"
                    type="number"
                    value={simForm.powerConsumption}
                    onChange={(e) => setSimForm({ ...simForm, powerConsumption: e.target.value })}
                    placeholder="e.g. 45"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sim-humidity">Humidity (%)</Label>
                  <Input
                    id="sim-humidity"
                    type="number"
                    value={simForm.humidity}
                    onChange={(e) => setSimForm({ ...simForm, humidity: e.target.value })}
                    placeholder="e.g. 60"
                  />
                </div>
              </div>
              <div className="mt-4">
                <Button onClick={handleSimulateTelemetry} disabled={simSending || !simForm.assetId.trim()}>
                  {simSending ? "Sending..." : "Send Telemetry"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
