"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { ShieldAlert, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"

interface ElevationRequest {
  id: string
  userId: string
  organizationId: string
  requestedRole: string
  reason: string
  durationMinutes: number
  status: string
  approvedBy?: string
  approvedAt?: string
  expiresAt: string
  createdAt: string
}

export default function JitAccessPage() {
  const { t } = useI18n()
  const [requests, setRequests] = useState<ElevationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState("super_admin")
  const [reason, setReason] = useState("")
  const [duration, setDuration] = useState("30")
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeElevation, setActiveElevation] = useState<{ role: string; expiresAt: string } | null>(null)

  const fetchData = useCallback(async (cancelled?: { current: boolean }) => {
    try {
      const res = await fetch("/api/v1/admin/jit")
      const data = await res.json()
      if (res.ok && (!cancelled || !cancelled.current)) {
        setRequests(data.requests || [])
        setActiveElevation(data.active ? { role: data.role, expiresAt: data.expiresAt } : null)
      }
    } catch {
      if (!cancelled || !cancelled.current) toast.error(t("admin.jit.loadFailed"))
    }
  }, [])

  useEffect(() => {
    const cancelled = { current: false }
    ;(async () => {
      try {
        setLoading(true)
        await fetchData(cancelled)
      } finally {
        if (!cancelled.current) setLoading(false)
      }
    })()
    return () => { cancelled.current = true }
  }, [fetchData])

  const handleRequest = async () => {
    if (!reason) {
      toast.error(t("admin.jit.reasonRequired"))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/v1/admin/jit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", role, reason, durationMinutes: parseInt(duration) }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(t("admin.jit.requestSubmitted"))
        setRequestDialogOpen(false)
        setReason("")
        fetchData()
      } else {
        toast.error(data.error || t("admin.jit.requestFailed"))
      }
    } catch {
      toast.error(t("admin.jit.requestFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  const handleAction = async (requestId: string, action: "approve" | "deny") => {
    try {
      const res = await fetch("/api/v1/admin/jit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, requestId }),
      })
      if (res.ok) {
        toast.success(`Request ${action}d`)
        fetchData()
      }
    } catch {
      toast.error(`Failed to ${action} request`)
    }
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      approved: "default",
      denied: "destructive",
      expired: "outline",
      revoked: "destructive",
    }
    return <Badge variant={map[status] || "secondary"}>{status}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.jit.title")}</h1>
          <p className="text-muted-foreground">{t("admin.jit.subtitle")}</p>
        </div>
        <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <ShieldAlert className="mr-2 h-4 w-4" />
              Request Elevation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.jit.requestTitle")}</DialogTitle>
              <DialogDescription>
                Your request will be logged and requires approval. Elevated access auto-expires.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("admin.jit.roleLabel")}</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">{t("admin.jit.superAdmin")}</SelectItem>
                    <SelectItem value="security_admin">{t("admin.jit.securityAdmin")}</SelectItem>
                    <SelectItem value="billing_admin">{t("admin.jit.billingAdmin")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("admin.jit.durationLabel")}</Label>
                <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} min={5} max={120} />
                <p className="text-xs text-muted-foreground">{t("admin.jit.durationHint")}</p>
              </div>
              <div className="space-y-2">
                <Label>{t("admin.jit.reasonLabel")}</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("admin.jit.reasonPlaceholder")} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>{t("admin.jit.cancel")}</Button>
              <Button onClick={handleRequest} disabled={submitting}>
                {submitting ? t("admin.jit.submitting") : t("admin.jit.submitRequest")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {activeElevation && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium">Active Elevation: {activeElevation.role}</p>
                <p className="text-sm text-muted-foreground">
                  Expires at {new Date(activeElevation.expiresAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={async () => {
              const res = await fetch("/api/v1/admin/jit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "revoke" }),
              })
              const result = await res.json()
              if (res.ok) {
                toast.success(t("admin.jit.revokedSuccess"))
              } else {
                toast.error(result.error || t("admin.jit.revokeFailed"))
              }
              fetchData()
            }}>
              Revoke Now
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.jit.requestsTitle")}</CardTitle>
          <CardDescription>{t("admin.jit.requestsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">{t("predictiveMaintenance.page.loading")}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.jit.role")}</TableHead>
                  <TableHead>{t("admin.jit.reasonLabel")}</TableHead>
                  <TableHead>{t("admin.jit.duration")}</TableHead>
                  <TableHead>{t("admin.jit.status")}</TableHead>
                  <TableHead>{t("admin.jit.expires")}</TableHead>
                  <TableHead>{t("admin.jit.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">{t("admin.jit.noRequests")}</TableCell>
                  </TableRow>
                ) : (
                  requests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell><Badge variant="outline">{req.requestedRole}</Badge></TableCell>
                      <TableCell className="max-w-[200px] truncate">{req.reason}</TableCell>
                      <TableCell>{req.durationMinutes}m</TableCell>
                      <TableCell>{getStatusBadge(req.status)}</TableCell>
                      <TableCell className="text-xs">{new Date(req.expiresAt).toLocaleString()}</TableCell>
                      <TableCell className="flex gap-1">
                        {req.status === "pending" && (
                          <>
                            <Button size="sm" variant="default" onClick={() => handleAction(req.id, "approve")}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleAction(req.id, "deny")}>
                              <XCircle className="h-3 w-3 mr-1" /> Deny
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.jit.securityPolicies")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{"\u2022"} All elevation requests require <strong>platform owner approval</strong></p>
          <p>{"\u2022"} Elevated access <strong>auto-expires</strong> after the requested duration (max 120 min)</p>
          <p>{"\u2022"} All elevation events are <strong>audit-logged</strong> with full traceability</p>
          <p>{"\u2022"} A clear <strong>reason</strong> must be provided for every request</p>
          <p>{"\u2022"} Principle of least privilege: request only the role you need</p>
        </CardContent>
      </Card>
    </div>
  )
}
