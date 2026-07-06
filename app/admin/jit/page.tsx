"use client"

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
  const [requests, setRequests] = useState<ElevationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState("super_admin")
  const [reason, setReason] = useState("")
  const [duration, setDuration] = useState("30")
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeElevation, setActiveElevation] = useState<{ role: string; expiresAt: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const statusRes = await fetch("/api/v1/admin/jit")
        const statusData = await statusRes.json()
        if (statusRes.ok && !cancelled) {
          if (statusData.active) {
            setActiveElevation({ role: statusData.role, expiresAt: statusData.expiresAt })
          } else {
            setActiveElevation(null)
          }
        }
      } catch {
        if (!cancelled) toast.error("Failed to load JIT access data")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleRequest = async () => {
    if (!reason) {
      toast.error("Please provide a reason for elevation")
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
        toast.success("Elevation request submitted")
        setRequestDialogOpen(false)
        setReason("")
        fetchData()
      } else {
        toast.error(data.error || "Failed to submit request")
      }
    } catch {
      toast.error("Failed to submit request")
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
          <h1 className="text-2xl font-bold">JIT Access Elevation</h1>
          <p className="text-muted-foreground">Request temporary elevated privileges for administrative tasks</p>
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
              <DialogTitle>Request Privilege Elevation</DialogTitle>
              <DialogDescription>
                Your request will be logged and requires approval. Elevated access auto-expires.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Requested Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="security_admin">Security Admin</SelectItem>
                    <SelectItem value="billing_admin">Billing Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} min={5} max={120} />
                <p className="text-xs text-muted-foreground">Max 120 minutes. Auto-expires after this period.</p>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why do you need elevated access?" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleRequest} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Request"}
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
              await fetch("/api/v1/admin/jit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "revoke" }),
              })
              fetchData()
              toast.success("Elevation revoked")
            }}>
              Revoke Now
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Elevation Requests</CardTitle>
          <CardDescription>Manage privilege elevation requests with time-boxed access</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">No elevation requests</TableCell>
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
          <CardTitle>Security Policies</CardTitle>
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
