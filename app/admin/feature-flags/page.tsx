"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Flag, Skull, AlertTriangle, Snail, Activity } from "lucide-react"

const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  ai: { label: "AI", color: "bg-violet-500/10 text-violet-500" },
  core: { label: "Core", color: "bg-blue-500/10 text-blue-500" },
  compliance: { label: "Compliance", color: "bg-amber-500/10 text-amber-500" },
  billing: { label: "Billing", color: "bg-emerald-500/10 text-emerald-500" },
}

interface FeatureFlagState {
  id: string
  name: string
  description: string
  defaultValue: boolean
  category: string
  enabled: boolean
  killed: boolean
  canaryPercent: number
}

export default function FeatureFlagsPage() {
  const { t } = useI18n()
  const [flags, setFlags] = useState<FeatureFlagState[]>([])
  const [loading, setLoading] = useState(true)
  const [killDialogOpen, setKillDialogOpen] = useState(false)
  const [selectedFlag, setSelectedFlag] = useState<string | null>(null)
  const [canaryValues, setCanaryValues] = useState<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [defRes, globalRes, killRes] = await Promise.all([
          fetch("/api/v1/admin/feature-flags/definitions"),
          fetch("/api/v1/admin/feature-flags"),
          fetch("/api/v1/admin/feature-flags/kill-switches"),
        ])

        const definitions = defRes.ok ? (await defRes.json()).definitions || [] : []
        const globalFlags = globalRes.ok ? (await globalRes.json()).flags || {} : {}
        const killed = killRes.ok ? (await killRes.json()).switches || {} : {}

        const merged = definitions.map((def: { id: string; name: string; description: string; defaultValue: boolean; category: string; canaryPercent?: number }) => ({
          id: def.id,
          name: def.name,
          description: def.description,
          defaultValue: def.defaultValue,
          category: def.category,
          enabled: globalFlags[def.id] ?? def.defaultValue,
          killed: killed[def.id] === true,
          canaryPercent: def.canaryPercent || 0,
        }))

        if (!cancelled) setFlags(merged)
        const vals: Record<string, number> = {}
        merged.forEach((f: FeatureFlagState) => { vals[f.id] = f.canaryPercent })
        if (!cancelled) setCanaryValues(vals)
      } catch {
        if (!cancelled) toast.error(t("admin.featureFlags.loadFailed"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const toggleFlag = async (flagId: string, value: boolean) => {
    try {
      const res = await fetch("/api/v1/admin/feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag: flagId, value }),
      })
      if (res.ok) {
        setFlags(prev => prev.map(f => f.id === flagId ? { ...f, enabled: value } : f))
        toast.success(`Feature "${flagId}" ${value ? "enabled" : "disabled"}`)
      } else {
        toast.error(t("admin.featureFlags.updateFailed"))
      }
    } catch {
      toast.error(t("admin.featureFlags.updateFailed"))
    }
  }

  const handleKillSwitch = async (flagId: string, enabled: boolean) => {
    try {
      const res = await fetch("/api/v1/admin/feature-flags/kill-switches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag: flagId, enabled }),
      })
      if (res.ok) {
        setFlags(prev => prev.map(f => f.id === flagId ? { ...f, killed: !enabled } : f))
        toast.success(`Kill switch for "${flagId}" ${enabled ? "deactivated" : "activated"}`)
        setKillDialogOpen(false)
        setSelectedFlag(null)
      } else {
        toast.error(t("admin.featureFlags.killFailed"))
      }
    } catch {
      toast.error(t("admin.featureFlags.killFailed"))
    }
  }

  const updateCanary = async (flagId: string, percent: number) => {
    setCanaryValues(prev => ({ ...prev, [flagId]: percent }))
    try {
      const res = await fetch("/api/v1/admin/feature-flags/canary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag: flagId, percent }),
      })
      if (!res.ok) toast.error(t("admin.featureFlags.canaryFailed"))
      else toast.success(`Canary set to ${percent}% for "${flagId}"`)
    } catch {
      toast.error(t("admin.featureFlags.canaryFailed"))
    }
  }

  const getStatusBadge = (enabled: boolean, killed: boolean) => {
    if (killed) return <Badge variant="destructive"><Skull className="mr-1 h-3 w-3" />{t("admin.featureFlags.killed")}</Badge>
    if (enabled) return <Badge variant="default" className="bg-emerald-500/10 text-emerald-500"><Activity className="mr-1 h-3 w-3" />{t("admin.featureFlags.active")}</Badge>
    return <Badge variant="secondary"><Flag className="mr-1 h-3 w-3" />{t("admin.featureFlags.disabled")}</Badge>
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("admin.featureFlags.title")}</h1>
            <p className="text-muted-foreground">{t("admin.featureFlags.platformwide_feature_flag_management")}</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">{t("admin.featureFlags.loading")}</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.featureFlags.title")}</h1>
          <p className="text-muted-foreground">{t("admin.featureFlags.subtitle")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            All Feature Flags
          </CardTitle>
          <CardDescription>
            Toggle features globally, activate kill switches for emergency shutdown, or configure canary rollouts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.featureFlags.feature")}</TableHead>
                <TableHead>{t("admin.featureFlags.category")}</TableHead>
                <TableHead>{t("admin.featureFlags.status")}</TableHead>
                <TableHead>{t("admin.featureFlags.globalOverride")}</TableHead>
                <TableHead>{t("admin.featureFlags.killSwitch")}</TableHead>
                <TableHead>{t("admin.featureFlags.canary")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">{t("admin.featureFlags.noFlags")}</TableCell>
                </TableRow>
              ) : (
                flags.map((flag) => {
                  const cat = CATEGORY_MAP[flag.category] || { label: flag.category, color: "bg-gray-500/10 text-gray-500" }
                  return (
                    <TableRow key={flag.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{flag.name}</p>
                          <p className="text-xs text-muted-foreground">{flag.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cat.color}>
                          {cat.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(flag.enabled, flag.killed)}</TableCell>
                      <TableCell>
                        <Switch
                          checked={flag.enabled}
                          onCheckedChange={(checked) => toggleFlag(flag.id, checked)}
                          disabled={flag.killed}
                          aria-label={`Toggle ${flag.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Dialog open={killDialogOpen && selectedFlag === flag.id} onOpenChange={(open) => { setKillDialogOpen(open); if (!open) setSelectedFlag(null) }}>
                          <DialogTrigger asChild>
                            <Button
                              variant={flag.killed ? "destructive" : "outline"}
                              size="sm"
                              onClick={() => setSelectedFlag(flag.id)}
                            >
                              <Skull className="mr-1 h-3 w-3" />
                              {flag.killed ? t("admin.featureFlags.reactivate") : t("admin.featureFlags.kill")}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                                {flag.killed ? t("admin.featureFlags.reactivateFeature") : t("admin.featureFlags.activateKillSwitch")}
                              </DialogTitle>
                              <DialogDescription>
                                {flag.killed
                                  ? `This will re-enable "${flag.name}" — the feature will resume normal operation.`
                                  : `This will immediately disable "${flag.name}" across the entire platform. Use only for emergency shutdowns.`
                                }
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => { setKillDialogOpen(false); setSelectedFlag(null) }}>
                                Cancel
                              </Button>
                              <Button
                                variant={flag.killed ? "default" : "destructive"}
                                onClick={() => handleKillSwitch(flag.id, flag.killed)}
                              >
                                {flag.killed ? t("admin.featureFlags.reactivateFeature") : t("admin.featureFlags.confirmKill")}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                      <TableCell className="min-w-[160px]">
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[canaryValues[flag.id] || 0]}
                            onValueChange={([v]) => updateCanary(flag.id, v)}
                            max={100}
                            step={1}
                            className="w-20"
                            aria-label={`${flag.name} canary percentage`}
                          />
                          <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                            {canaryValues[flag.id] || 0}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Skull className="h-5 w-5" />
            Emergency Kill Switches
          </CardTitle>
          <CardDescription>
            Kill switches force a feature off globally, overriding all other flag settings. Use only for critical incidents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{"\u2022"} Kill switches bypass global overrides, org-level overrides, and entitlement gating</p>
            <p>{"\u2022"} Activating a kill switch immediately disables the feature for all users</p>
            <p>{"\u2022"} All kill switch activations are audit-logged with timestamps</p>
            <p>{"\u2022"} Canary deployments allow gradual rollouts to a percentage of users</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
