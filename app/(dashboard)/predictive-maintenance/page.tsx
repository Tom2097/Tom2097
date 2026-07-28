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
import { useI18n } from "@/components/providers/i18n-provider"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"
import { InView } from "@/components/motion-primitives/in-view"

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
  const { t } = useI18n()
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

  const numericFields = [
    { key: "temperature", label: t('predictiveMaintenance.page.temperature') },
    { key: "vibration", label: t('predictiveMaintenance.page.vibration') },
    { key: "pressure", label: t('predictiveMaintenance.page.pressure') },
    { key: "rpm", label: t('predictiveMaintenance.page.rpm') },
    { key: "powerConsumption", label: t('predictiveMaintenance.page.powerConsumption') },
    { key: "humidity", label: t('predictiveMaintenance.page.humidity') },
  ] as const

  const fetchSchedule = useCallback(async (cancelled?: { current: boolean }) => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/predictive/rul");
      
      if (cancelled?.current) return;
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || t('predictiveMaintenance.page.errors.loadFailed'));
      }
      
      const data = await res.json();
      if (!cancelled?.current) {
        setSchedule(data.schedule || []);
      }
    } catch (error) {
      if (!cancelled?.current) {
        toast.error(error instanceof Error ? error.message : t('predictiveMaintenance.page.errors.loadFailed'));
      }
    } finally {
      if (!cancelled?.current) {
        setLoading(false);
      }
    }
  }, [t]);

  useEffect(() => {
    const cancelled = { current: false };
    const load = async () => {
      setLoading(true);
      try {
        await fetchSchedule(cancelled);
      } finally {
        if (!cancelled.current) setLoading(false);
      }
    };
    load();
    return () => { cancelled.current = true; };
  }, [fetchSchedule]);

  const handleLookupAsset = async () => {
    if (!assetId.trim()) {
      toast.error(t('predictiveMaintenance.page.errors.enterAssetId'));
      return;
    }
    
    try {
      setAssetLoading(true);
      const res = await fetch(`/api/v1/predictive/rul?assetId=${encodeURIComponent(assetId)}`);
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || t('predictiveMaintenance.page.errors.lookupFailed'));
      }
      
      const data = await res.json();
      setAssetRules(data);
    } catch (error) {
       toast.error(error instanceof Error ? error.message : t('predictiveMaintenance.page.errors.lookupFailed'));
    } finally {
      setAssetLoading(false);
    }
  };

  const validateSimForm = () => {
    if (!simForm.assetId.trim()) {
      toast.error(t('predictiveMaintenance.page.errors.enterAssetId'));
      return false;
    }
    
    for (const field of numericFields) {
      if (simForm[field.key] && isNaN(parseFloat(simForm[field.key] as string))) {
        toast.error(t('predictiveMaintenance.page.errors.mustBeNumber', { field: field.label }));
        return false;
      }
    }
    
    return true;
  };

  const handleSimulateTelemetry = async () => {
    if (!validateSimForm()) return;
    
    const reading: Record<string, unknown> = {
      assetId: simForm.assetId,
      timestamp: new Date().toISOString(),
    };
    if (simForm.temperature) reading.temperature = parseFloat(simForm.temperature);
    if (simForm.vibration) reading.vibration = parseFloat(simForm.vibration);
    if (simForm.pressure) reading.pressure = parseFloat(simForm.pressure);
    if (simForm.rpm) reading.rpm = parseFloat(simForm.rpm);
    if (simForm.powerConsumption) reading.powerConsumption = parseFloat(simForm.powerConsumption);
    if (simForm.humidity) reading.humidity = parseFloat(simForm.humidity);

    try {
      setSimSending(true);
      const res = await fetch("/api/v1/predictive/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reading),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || t('predictiveMaintenance.page.errors.ingestFailed'));
      }
      
      toast.success(t('predictiveMaintenance.page.success.telemetryIngested'));
      setSimForm({
        assetId: simForm.assetId,
        temperature: "",
        vibration: "",
        pressure: "",
        rpm: "",
        powerConsumption: "",
        humidity: "",
      });
      fetchSchedule();
    } catch (error) {
       toast.error(error instanceof Error ? error.message : t('predictiveMaintenance.page.errors.ingestFailed'));
    } finally {
      setSimSending(false);
    }
  };

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
      case "replace": return <Badge variant="destructive">{t(`predictiveMaintenance.page.actions.${action}`)}</Badge>
      case "maintain": return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20">{t(`predictiveMaintenance.page.actions.${action}`)}</Badge>
      case "inspect": return <Badge variant="secondary">{t(`predictiveMaintenance.page.actions.${action}`)}</Badge>
      case "monitor": return <Badge variant="outline">{t(`predictiveMaintenance.page.actions.${action}`)}</Badge>
      default: return <Badge variant="outline">{action}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <AnimatedGroup className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-500">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('predictiveMaintenance.page.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('predictiveMaintenance.page.subtitle')}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-red-500" />
                {t('predictiveMaintenance.page.overdue')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-3xl font-bold text-red-500">{overdue.length}</p>
              <p className="text-xs text-muted-foreground">{t('predictiveMaintenance.page.assetsPastDue')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-amber-500" />
                {t('predictiveMaintenance.page.dueSoon')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-3xl font-bold text-amber-500">{dueSoon.length}</p>
              <p className="text-xs text-muted-foreground">{t('predictiveMaintenance.page.daysRemaining')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Wrench className="h-4 w-4 text-amber-500" />
                {t('predictiveMaintenance.page.needsAction')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-3xl font-bold text-amber-500">{critical.length}</p>
              <p className="text-xs text-muted-foreground">{t('predictiveMaintenance.page.highFailureProbability')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                {t('predictiveMaintenance.page.healthy')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-3xl font-bold text-emerald-500">{healthy.length}</p>
              <p className="text-xs text-muted-foreground">{t('predictiveMaintenance.page.daysRemaining90')}</p>
            </CardContent>
          </Card>
        </div>
      </AnimatedGroup>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            {t('predictiveMaintenance.page.schedule')}
          </TabsTrigger>
          <TabsTrigger value="lookup" className="gap-2">
            <Info className="h-4 w-4" />
            {t('predictiveMaintenance.page.assetLookup')}
          </TabsTrigger>
          <TabsTrigger value="simulator" className="gap-2">
            <Plus className="h-4 w-4" />
            {t('predictiveMaintenance.page.telemetrySimulator')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <InView>
          <Card>
            <CardHeader>
              <CardTitle>{t('predictiveMaintenance.page.schedule')}</CardTitle>
              <CardDescription>{t('predictiveMaintenance.page.asset')}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">{t('predictiveMaintenance.page.loading')}</div>
              ) : schedule.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  {t('predictiveMaintenance.page.noAssets')}
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('predictiveMaintenance.page.asset')}</TableHead>
                        <TableHead>{t('predictiveMaintenance.page.rulDays')}</TableHead>
                        <TableHead>{t('predictiveMaintenance.page.failureProbability')}</TableHead>
                        <TableHead>{t('predictiveMaintenance.page.confidence')}</TableHead>
                        <TableHead>{t('predictiveMaintenance.page.action')}</TableHead>
                        <TableHead>{t('predictiveMaintenance.page.nextMaintenance')}</TableHead>
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
                                {asset.estimatedRulDays === 0 ? t('predictiveMaintenance.page.overdueLabel') : asset.estimatedRulDays}
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
                              {t(`predictiveMaintenance.page.confidenceLevels.${asset.confidenceLevel}`)}
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
          </InView>
        </TabsContent>

        <TabsContent value="lookup" className="mt-4 space-y-4">
          <InView delay={0.08}>
          <Card>
            <CardHeader>
              <CardTitle>{t('predictiveMaintenance.page.assetLookup')}</CardTitle>
              <CardDescription>{t('predictiveMaintenance.page.assetLookupDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder={t('predictiveMaintenance.page.enterAssetId')}
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  className="max-w-sm"
                />
                <Button onClick={handleLookupAsset} disabled={assetLoading}>
                  {assetLoading ? t('predictiveMaintenance.page.loading') : t('predictiveMaintenance.page.lookUp')}
                </Button>
              </div>

              {assetRules && (
                <div className="space-y-4">
                  {assetRules.rul && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{assetRules.rul.assetName}</CardTitle>
                        <CardDescription>{t('predictiveMaintenance.page.rulDays')}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <p className="text-sm text-muted-foreground">{t('predictiveMaintenance.page.remainingLife')}</p>
                            <p className="text-2xl font-bold">{assetRules.rul.estimatedRulDays} <span className="text-sm font-normal text-muted-foreground">{t('predictiveMaintenance.page.days')}</span></p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">{t('predictiveMaintenance.page.failureProbability')}</p>
                            <p className="text-2xl font-bold">{(assetRules.rul.failureProbability * 100).toFixed(0)}%</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">{t('predictiveMaintenance.page.confidence')}</p>
                            <p className="text-2xl font-bold capitalize">{t(`predictiveMaintenance.page.confidenceLevels.${assetRules.rul.confidenceLevel}`)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">{t('predictiveMaintenance.page.recommendedAction')}</p>
                            <p className="text-2xl font-bold">{actionBadge(assetRules.rul.recommendedAction)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle>{t('predictiveMaintenance.page.alerts')}</CardTitle>
                      <CardDescription>{t('predictiveMaintenance.page.recentAnomalies')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {assetRules.alerts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('predictiveMaintenance.page.noAnomalies')}</p>
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
          </InView>
        </TabsContent>

        <TabsContent value="simulator" className="mt-4 space-y-4">
          <InView delay={0.16}>
          <Card>
            <CardHeader>
              <CardTitle>{t('predictiveMaintenance.page.telemetrySimulator')}</CardTitle>
              <CardDescription>{t('predictiveMaintenance.page.telemetryDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="sim-asset-id">{t('predictiveMaintenance.page.assetIdRequired')}</Label>
                  <Input
                    id="sim-asset-id"
                    value={simForm.assetId}
                    onChange={(e) => setSimForm({ ...simForm, assetId: e.target.value })}
                    placeholder="asset-001"
                  />
                </div>
                {numericFields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={`sim-${field.key}`}>{field.label}</Label>
                    <Input
                      id={`sim-${field.key}`}
                      type="number"
                      value={simForm[field.key]}
                      onChange={(e) => setSimForm({ ...simForm, [field.key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Button onClick={handleSimulateTelemetry} disabled={simSending || !simForm.assetId.trim()}>
                  {simSending ? t('predictiveMaintenance.page.sending') : t('predictiveMaintenance.page.sendTelemetry')}
                </Button>
              </div>
            </CardContent>
          </Card>
          </InView>
        </TabsContent>
      </Tabs>
    </div>
  )
}
