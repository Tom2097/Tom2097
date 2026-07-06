"use client"

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
  const [sessions, setSessions] = useState<ImpersonationSession[]>([])
  const [loading, setLoading] = useState(true)
  const [targetEmail, setTargetEmail] = useState("")
  const [reason, setReason] = useState("")
  const [searchResult, setSearchResult] = useState<{ id: string; email: string; name: string; orgName: string } | null>(null)
  const [isStartDialogOpen, setIsStartDialogOpen] = useState(false)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const res = await fetch("/api/v1/admin/impersonate")
        const data = await res.json()
        if (res.ok && !cancelled) {
          setSessions(data.sessions || [])
        }
      } catch {
        if (!cancelled) toast.error("Failed to load impersonation sessions")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const searchUser = async () => {
    if (!targetEmail) return
    try {
      const res = await fetch(`/api/v1/admin/users/search?email=${encodeURIComponent(targetEmail)}`)
      const data = await res.json()
      if (res.ok && data.user) {
        setSearchResult(data.user)
      } else {
        toast.error("User not found")
        setSearchResult(null)
      }
    } catch {
      toast.error("Failed to search user")
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
        toast.error(data.error || "Failed to start impersonation")
      }
    } catch {
      toast.error("Failed to start impersonation")
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
        toast.success("Impersonation session ended")
        fetchSessions()
      }
    } catch {
      toast.error("Failed to end impersonation")
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
          <h1 className="text-2xl font-bold">Impersonation</h1>
          <p className="text-muted-foreground">Sign in as users for support and troubleshooting</p>
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
              <DialogTitle>Start Impersonation Session</DialogTitle>
              <DialogDescription>
                You will be able to view the platform as this user. All actions are audited and time-boxed to 60 minutes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Target User Email</Label>
                <div className="flex gap-2">
                  <Input
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    placeholder="user@company.com"
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
                      <p><strong>Name:</strong> {searchResult.name}</p>
                      <p><strong>Email:</strong> {searchResult.email}</p>
                      <p><strong>Organization:</strong> {searchResult.orgName}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              <div className="space-y-2">
                <Label>Reason for Impersonation</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Investigating a support ticket, troubleshooting access issue"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsStartDialogOpen(false)}>Cancel</Button>
              <Button onClick={startImpersonation} disabled={!searchResult || starting}>
                {starting ? "Starting..." : "Start Session"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Impersonation Sessions</CardTitle>
          <CardDescription>
            All impersonation sessions are audited and automatically expire after 60 minutes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No active impersonation sessions</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target User</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Consent</TableHead>
                  <TableHead>Actions</TableHead>
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
                        <Badge variant="outline" className="text-green-500">Granted</Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-500">Pending</Badge>
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
          <CardTitle>Security Guidelines</CardTitle>
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
