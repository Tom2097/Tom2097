"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { FileText, Plus, Loader2, Download, Pencil, ShieldOff, Check, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

interface DsarRequest {
  id: string
  subject_email: string
  request_type: "access" | "erasure" | "rectification" | "portability" | "restriction"
  status: "open" | "in_progress" | "awaiting_verification" | "completed" | "rejected"
  created_at: string
}

interface ConsentRecord {
  id: string
  consent_type: string
  granted: boolean
  granted_at: string
}

const requestTypeLabels: Record<string, string> = {
  access: "Access",
  erasure: "Erasure",
  rectification: "Rectification",
  portability: "Portability",
  restriction: "Restriction",
}

const statusColors: Record<string, string> = {
  open: "bg-amber-500/20 text-amber-600",
  in_progress: "bg-blue-500/20 text-blue-600",
  awaiting_verification: "bg-cyan-500/20 text-cyan-600",
  completed: "bg-chart-2/20 text-chart-2",
  rejected: "bg-red-500/20 text-red-600",
}

const CONSENT_PURPOSES = ["marketing", "analytics", "third_party_sharing"]

export function ComplianceDsar() {
  const [requests, setRequests] = useState<DsarRequest[]>([])
  const [consents, setConsents] = useState<ConsentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [newRequest, setNewRequest] = useState({ subjectEmail: "", requestType: "access" as DsarRequest["request_type"] })
  const [submitting, setSubmitting] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportData, setExportData] = useState<Record<string, unknown> | null>(null)
  const [exporting, setExporting] = useState(false)
  const [rectifyOpen, setRectifyOpen] = useState(false)
  const [rectifyField, setRectifyField] = useState({ field: "full_name", value: "" })
  const [rectifying, setRectifying] = useState(false)
  const [restricted, setRestricted] = useState(false)
  const [updatingConsent, setUpdatingConsent] = useState<string | null>(null)

  const fetchRequests = async () => {
    const res = await fetch("/api/v1/compliance/dsar?type=requests")
    if (res.ok) {
      const data = await res.json()
      setRequests(Array.isArray(data.requests) ? data.requests : [])
    }
  }

  const fetchConsents = async () => {
    const res = await fetch("/api/v1/compliance/dsar?type=consent")
    if (res.ok) {
      const data = await res.json()
      setConsents(Array.isArray(data.records) ? data.records : [])
    }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    Promise.all([fetchRequests(), fetchConsents()]).finally(() => setLoading(false))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const handleCreateRequest = async () => {
    if (!newRequest.subjectEmail.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/v1/compliance/dsar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", requestType: newRequest.requestType, subjectEmail: newRequest.subjectEmail.trim() }),
      })
      if (res.ok) {
        toast.success("DSAR request logged")
        setAddOpen(false)
        setNewRequest({ subjectEmail: "", requestType: "access" })
        fetchRequests()
      } else {
        toast.error("Failed to log DSAR request")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (requestId: string, status: DsarRequest["status"]) => {
    const res = await fetch("/api/v1/compliance/dsar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, status }),
    })
    if (res.ok) fetchRequests()
    else toast.error("Failed to update request status")
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch("/api/v1/compliance/dsar?type=export")
      if (res.ok) {
        const data = await res.json()
        setExportData(data.data ?? null)
        setExportOpen(true)
      } else {
        toast.error("Failed to export data")
      }
    } finally {
      setExporting(false)
    }
  }

  const handleRectify = async () => {
    if (!rectifyField.field.trim() || !rectifyField.value.trim()) return
    setRectifying(true)
    try {
      const res = await fetch("/api/v1/compliance/dsar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rectify", field: rectifyField.field.trim(), value: rectifyField.value.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success("Profile field updated")
        setRectifyOpen(false)
        setRectifyField({ field: "full_name", value: "" })
      } else {
        toast.error("Failed to update field")
      }
    } finally {
      setRectifying(false)
    }
  }

  const handleRestrictToggle = async (checked: boolean) => {
    setRestricted(checked)
    const res = await fetch("/api/v1/compliance/dsar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restrict", restricted: checked }),
    })
    if (res.ok) {
      toast.success(checked ? "Processing restricted" : "Processing restriction lifted")
    } else {
      setRestricted(!checked)
      toast.error("Failed to update processing restriction")
    }
  }

  const handleConsentToggle = async (purpose: string, currentlyGranted: boolean) => {
    setUpdatingConsent(purpose)
    try {
      const res = await fetch("/api/v1/compliance/dsar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "consent", purpose, revoke: currentlyGranted }),
      })
      if (res.ok) fetchConsents()
      else toast.error("Failed to update consent")
    } finally {
      setUpdatingConsent(null)
    }
  }

  const isGranted = (purpose: string) => {
    const record = consents.find((c) => c.consent_type === purpose)
    return record?.granted ?? false
  }

  if (loading) {
    return <Card className="p-6 border-border/50 bg-card/50"><div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div></Card>
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 border-border/50 bg-card/50">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-foreground">Data Subject Requests</h3>
            <p className="text-sm text-muted-foreground">Track and triage GDPR/DPDP data subject access requests</p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Log Request</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log a Data Subject Request</DialogTitle>
                <DialogDescription>Record a request received from a data subject</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Subject Email</Label>
                  <Input
                    type="email"
                    value={newRequest.subjectEmail}
                    onChange={(e) => setNewRequest((p) => ({ ...p, subjectEmail: e.target.value }))}
                    placeholder="subject@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Request Type</Label>
                  <Select value={newRequest.requestType} onValueChange={(v) => setNewRequest((p) => ({ ...p, requestType: v as DsarRequest["request_type"] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(requestTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateRequest} disabled={!newRequest.subjectEmail.trim() || submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Log Request
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {requests.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No data subject requests logged</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req, i) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between p-4 rounded-lg border border-border/50"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{req.subject_email}</p>
                    <Badge variant="outline" className="text-xs">{requestTypeLabels[req.request_type]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Logged {new Date(req.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={statusColors[req.status]}>{req.status.replace("_", " ")}</Badge>
                  {req.status !== "completed" && req.status !== "rejected" && (
                    <>
                      <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={() => handleStatusChange(req.id, "completed")}>
                        <Check className="w-3 h-3" />Complete
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={() => handleStatusChange(req.id, "rejected")}>
                        <X className="w-3 h-3" />Reject
                      </Button>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6 border-border/50 bg-card/50">
        <div className="mb-6">
          <h3 className="font-semibold text-foreground">Your Privacy Controls</h3>
          <p className="text-sm text-muted-foreground">Self-service actions on your own account data</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Button variant="outline" className="justify-start gap-2 h-auto py-3" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <div className="text-left">
              <p className="text-sm font-medium">Export My Data</p>
              <p className="text-xs text-muted-foreground font-normal">Right of access</p>
            </div>
          </Button>
          <Dialog open={rectifyOpen} onOpenChange={setRectifyOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="justify-start gap-2 h-auto py-3">
                <Pencil className="w-4 h-4" />
                <div className="text-left">
                  <p className="text-sm font-medium">Correct a Field</p>
                  <p className="text-xs text-muted-foreground font-normal">Right of rectification</p>
                </div>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Correct Profile Data</DialogTitle>
                <DialogDescription>Update a field on your profile</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Field</Label>
                  <Input value={rectifyField.field} onChange={(e) => setRectifyField((p) => ({ ...p, field: e.target.value }))} placeholder="full_name" />
                </div>
                <div className="space-y-2">
                  <Label>New Value</Label>
                  <Input value={rectifyField.value} onChange={(e) => setRectifyField((p) => ({ ...p, value: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRectifyOpen(false)}>Cancel</Button>
                <Button onClick={handleRectify} disabled={!rectifyField.field.trim() || !rectifyField.value.trim() || rectifying}>
                  {rectifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <ShieldOff className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Restrict Processing</p>
                <p className="text-xs text-muted-foreground">Right to restriction</p>
              </div>
            </div>
            <Switch checked={restricted} onCheckedChange={handleRestrictToggle} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          To permanently delete your account (right to erasure), use Settings &gt; Security &gt; Danger Zone.
        </p>
      </Card>

      <Card className="p-6 border-border/50 bg-card/50">
        <div className="mb-6">
          <h3 className="font-semibold text-foreground">Consent</h3>
          <p className="text-sm text-muted-foreground">Manage what you&apos;ve consented to</p>
        </div>
        <div className="space-y-3">
          {CONSENT_PURPOSES.map((purpose) => {
            const granted = isGranted(purpose)
            return (
              <div key={purpose} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                <span className="text-sm capitalize">{purpose.replace("_", " ")}</span>
                <Switch
                  checked={granted}
                  disabled={updatingConsent === purpose}
                  onCheckedChange={() => handleConsentToggle(purpose, granted)}
                />
              </div>
            )
          })}
        </div>
      </Card>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Your Data Export</DialogTitle>
            <DialogDescription>A copy of the personal data associated with your account</DialogDescription>
          </DialogHeader>
          <pre className="max-h-96 overflow-auto rounded-lg bg-muted/50 p-4 text-xs">
            {JSON.stringify(exportData, null, 2)}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
