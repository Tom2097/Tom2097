"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"
import { UserCheck, Clock, ShieldAlert, Search } from "lucide-react"

interface ImpersonationSession {
  id: string
  adminUserId: string
  targetUserId: string
  targetEmail: string
  targetOrganizationId: string
  reason: string
  startedAt: string
  expiresAt: string
  endedAt: string | null
  consentGranted: boolean
}

export default function ImpersonationPage() {
  const { t } = useI18n()
  const [sessions, setSessions] = useState<ImpersonationSession[]>([])
  const [loading, setLoading] = useState(true)
  const [targetEmail, setTargetEmail] = useState("")
  const [reason, setReason] = useState("")
  const [searchResult, setSearchResult] = useState<{ id: string; email: string; name: string; orgName: string } | null>(null)
  const [isStartDialogOpen, setIsStartDialogOpen] = useState(false)
  const [starting, setStarting] = useState(false)

  const fetchSessions = useCallback(async (cancelled?: { current: boolean }) => {
    try {
      const res = await fetch("/api/v1/admin/impersonate")
      const data = await res.json()
      if (res.ok && (!cancelled || !cancelled.current)) {
        setSessions(data.sessions || [])
      }
    } catch {
      if (!cancelled || !cancelled.current) toast.error(t("admin.impersonation.loadFailed"))
    }
  }, [])

  useEffect(() => {
    const cancelled = { current: false }
    ;(async () => {
      try {
        setLoading(true)
        await fetchSessions(cancelled)
      } finally {
        if (!cancelled.current) setLoading(false)
      }
    })()
    return () => { cancelled.current = true }
  }, [fetchSessions])

  const searchUser = async () => {
    if (!targetEmail) return
    try {
      const res = await fetch(`/api/v1/admin/users/search?email=${encodeURIComponent(targetEmail)}`)
      const data = await res.json()
      if (res.ok && data.user) {
        setSearchResult(data.user)
      } else {
        toast.error(t("admin.impersonation.userNotFound"))
        setSearchResult(null)
      }
    } catch {
      toast.error(t("admin.impersonation.searchFailed"))
    }
  }

  const startImpersonation = async () => {
    if (!searchResult) return
    setStarting(true)
    try {
      const res = await fetch("/api/v1/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", targetUserId: searchResult.id, reason }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Impersonating ${searchResult.email}`)
        setIsStartDialogOpen(false)
        setTargetEmail("")
        setReason("")
        setSearchResult(null)
        fetchSessions()
      } else {
        toast.error(data.error || t("admin.impersonation.startFailed"))
      }
    } catch {
      toast.error(t("admin.impersonation.startFailed"))
    } finally {
      setStarting(false)
    }
  }

  const endImpersonation = async (sessionId: string) => {
    try {
      const res = await fetch("/api/v1/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", sessionId }),
      })
      if (res.ok) {
        toast.success(t("admin.impersonation.endedSuccess"))
        fetchSessions()
      }
    } catch {
      toast.error(t("admin.impersonation.endFailed"))
    }
  }

  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString()
  }

  const getTimeRemaining = (expiresAt: string) => {
    const remaining = new Date(expiresAt).getTime() - now
    if (remaining <= 0) return "Expired"
    const minutes = Math.floor(remaining / 60000)
    return `${minutes}m remaining`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.impersonation.title")}</h1>
          <p className="text-muted-foreground">{t("admin.impersonation.subtitle")}</p>
        </div>
        <Dialog open={isStartDialogOpen} onOpenChange={setIsStartDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserCheck className="mr-2 h-4 w-4" />
              Start Impersonation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.impersonation.startSessionTitle")}</DialogTitle>
              <DialogDescription>
                You will be able to view the platform as this user. All actions are audited and time-boxed to 60 minutes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("admin.impersonation.targetEmailLabel")}</Label>
                <div className="flex gap-2">
                  <Input
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    placeholder={t("admin.impersonation.targetEmailPlaceholder")}
                    onKeyDown={(e) => e.key === "Enter" && searchUser()}
                  />
                  <Button variant="outline" onClick={searchUser} type="button">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {searchResult && (
                <Card>
                  <CardContent className="p-3">
                    <div className="text-sm">
                      <p><strong>{t("admin.impersonation.name")}</strong> {searchResult.name}</p>
                      <p><strong>{t("admin.impersonation.email")}</strong> {searchResult.email}</p>
                      <p><strong>{t("admin.impersonation.organization")}</strong> {searchResult.orgName}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              <div className="space-y-2">
                <Label>{t("admin.impersonation.reasonLabel")}</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("admin.impersonation.reasonPlaceholder")}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsStartDialogOpen(false)}>{t("admin.impersonation.cancel")}</Button>
              <Button onClick={startImpersonation} disabled={!searchResult || starting}>
                {starting ? t("admin.impersonation.starting") : t("admin.impersonation.startSession")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.impersonation.activeSessions")}</CardTitle>
          <CardDescription>
            All impersonation sessions are audited and automatically expire after 60 minutes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">{t("predictiveMaintenance.page.loading")}</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{t("admin.impersonation.noSessions")}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.impersonation.targetUser")}</TableHead>
                  <TableHead>{t("admin.impersonation.organizationId")}</TableHead>
                  <TableHead>{t("admin.impersonation.reason")}</TableHead>
                  <TableHead>{t("admin.impersonation.started")}</TableHead>
                  <TableHead>{t("admin.impersonation.expires")}</TableHead>
                  <TableHead>{t("admin.impersonation.consent")}</TableHead>
                  <TableHead>{t("admin.impersonation.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>{session.targetEmail}</TableCell>
                    <TableCell className="font-mono text-xs">{session.targetOrganizationId.slice(0, 8)}...</TableCell>
                    <TableCell className="max-w-[200px] truncate">{session.reason}</TableCell>
                    <TableCell className="text-xs">{formatTime(session.startedAt)}</TableCell>
                    <TableCell>
                      <Badge variant={getTimeRemaining(session.expiresAt) === "Expired" ? "destructive" : "secondary"}>
                        <Clock className="mr-1 h-3 w-3" />
                        {getTimeRemaining(session.expiresAt)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {session.consentGranted ? (
                        <Badge variant="outline" className="text-green-500">{t("admin.impersonation.granted")}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-500">{t("admin.impersonation.pending")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="destructive" size="sm" onClick={() => endImpersonation(session.id)}>
                        <ShieldAlert className="mr-1 h-3 w-3" />
                        End
                      </Button>
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
          <CardTitle>{t("admin.impersonation.securityGuidelines")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{"\u2022"} Impersonation sessions are limited to <strong>60 minutes</strong> maximum</p>
          <p>{"\u2022"} Target user <strong>consent</strong> is required before accessing their data</p>
          <p>{"\u2022"} All actions during impersonation are <strong>audited</strong> with full traceability</p>
          <p>{"\u2022"} Impersonation is restricted to <strong>platform owners</strong> only</p>
          <p>{"\u2022"} Sessions must have a documented <strong>reason</strong> for compliance purposes</p>
        </CardContent>
      </Card>
    </div>
  )
}
