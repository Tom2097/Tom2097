"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"
import { ShieldAlert, Shield, Clock, AlertTriangle, Ban, CheckCircle2 } from "lucide-react"
import type { BreakGlassSession } from "@/lib/auth/break-glass"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"

export default function BreakGlassPage() {
  const { t } = useI18n()
  const [sessions, setSessions] = useState<BreakGlassSession[]>([])
  const [loading, setLoading] = useState(true)
  const [activateDialogOpen, setActivateDialogOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [justification, setJustification] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const res = await fetch("/api/v1/admin/break-glass")
        const data = await res.json()
        if (res.ok && !cancelled) setSessions(data.sessions || [])
      } catch {
        if (!cancelled) toast.error("Failed to load break-glass sessions")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/v1/admin/break-glass")
      const data = await res.json()
      if (res.ok) setSessions(data.sessions || [])
    } catch {
      toast.error("Failed to refresh sessions")
    }
  }

  const handleActivate = async () => {
    if (!reason) {
      toast.error(t("admin.breakGlass.reasonRequired"))
      return
    }
    if (!justification) {
      toast.error(t("admin.breakGlass.justificationRequired"))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/v1/admin/break-glass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate", reason: `${reason} — ${justification}` }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(t("admin.breakGlass.activatedSuccess"))
        setActivateDialogOpen(false)
        setReason("")
        setJustification("")
        fetchSessions()
      } else {
        toast.error(data.error || t("admin.breakGlass.activateFailed"))
      }
    } catch {
      toast.error(t("admin.breakGlass.activateFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  const handleRevoke = async (sessionId: string) => {
    try {
      const res = await fetch("/api/v1/admin/break-glass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", sessionId }),
      })
      if (res.ok) {
        toast.success(t("admin.breakGlass.revokedSuccess"))
        fetchSessions()
      }
    } catch {
      toast.error(t("admin.breakGlass.revokeFailed"))
    }
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "destructive",
      expired: "outline",
      ended: "secondary",
      revoked: "secondary",
    }
    return <Badge variant={map[status] ?? "outline"}>{status}</Badge>
  }

  const activeSessions = sessions.filter(s => s.status === "active")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <AnimatedGroup>
          <h1 className="text-2xl font-bold">{t("admin.breakGlass.title")}</h1>
          <p className="text-muted-foreground">{t("admin.breakGlass.subtitle")}</p>
        </AnimatedGroup>
        <Dialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">
              <ShieldAlert className="mr-2 h-4 w-4" />
              Activate Break-Glass
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.breakGlass.emergencyTitle")}</DialogTitle>
              <DialogDescription>
                This will grant you super_admin privileges for 30 minutes. All security teams will be alerted immediately.
                This action is irreversible and fully audited.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{t("admin.breakGlass.warning")}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  All platform owners and security team members will be notified immediately.
                </p>
              </div>
              <div className="space-y-2">
                <Label>{t("admin.breakGlass.reasonLabel")}</Label>
                <Input
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder={t("admin.breakGlass.reasonPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.breakGlass.justificationLabel")}</Label>
                <Textarea
                  value={justification}
                  onChange={e => setJustification(e.target.value)}
                  placeholder={t("admin.breakGlass.justificationPlaceholder")}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActivateDialogOpen(false)}>{t("admin.breakGlass.cancel")}</Button>
              <Button variant="destructive" onClick={handleActivate} disabled={submitting}>
                {submitting ? t("admin.breakGlass.activating") : t("admin.breakGlass.activateAndAlarm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {activeSessions.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 animate-pulse" />
              <div>
                <p className="font-medium text-red-600">{activeSessions.length} Active Break-Glass Session{activeSessions.length > 1 ? "s" : ""}</p>
                <p className="text-sm text-muted-foreground">
                  Alarm triggered. Emergency super_admin access is currently active.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.breakGlass.sessionsTitle")}</CardTitle>
          <CardDescription>{t("admin.breakGlass.sessionsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">{t("predictiveMaintenance.page.loading")}</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{t("admin.breakGlass.noSessions")}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.breakGlass.reason")}</TableHead>
                  <TableHead>{t("admin.breakGlass.role")}</TableHead>
                  <TableHead>{t("admin.breakGlass.status")}</TableHead>
                  <TableHead>{t("admin.breakGlass.alarm")}</TableHead>
                  <TableHead>{t("admin.breakGlass.started")}</TableHead>
                  <TableHead>{t("admin.breakGlass.expires")}</TableHead>
                  <TableHead>{t("admin.breakGlass.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="max-w-[200px] truncate font-medium">{session.reason}</TableCell>
                    <TableCell><Badge variant="outline">{session.role}</Badge></TableCell>
                    <TableCell>{getStatusBadge(session.status)}</TableCell>
                    <TableCell>
                      {session.alarmTriggered ? (
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                          <AlertTriangle className="h-3 w-3" />
                          Triggered
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <CheckCircle2 className="h-3 w-3" />
                          None
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{new Date(session.startedAt).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {new Date(session.expiresAt).toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      {session.status === "active" && (
                        <Button variant="destructive" size="sm" onClick={() => handleRevoke(session.id)}>
                          <Ban className="mr-1 h-3 w-3" />
                          Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.breakGlass.securityGuidelines")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{"\u2022"} Break-glass access is <strong>time-limited to 30 minutes</strong> and auto-expires</p>
          <p>{"\u2022"} Activation triggers an <strong>immediate security alarm</strong> notifying all platform owners</p>
          <p>{"\u2022"} A detailed <strong>justification</strong> is required for compliance and post-incident review</p>
          <p>{"\u2022"} All actions during break-glass sessions are <strong>audit-logged</strong> with maximum visibility</p>
          <p>{"\u2022"} Use only when standard JIT elevation is unavailable or insufficient</p>
          <p>{"\u2022"} Sessions must be <strong>revoked manually</strong> once the emergency is resolved</p>
        </CardContent>
      </Card>
    </div>
  )
}
