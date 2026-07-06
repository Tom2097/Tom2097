'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Fingerprint,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  FileText,
  Mail,
  User,
  ScrollText,
  Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SignatureAuditEntry {
  timestamp: string
  action: 'sent' | 'viewed' | 'signed' | 'declined' | 'expired'
  user: string
  ipAddress: string
  details: string
}

interface SignatureRequest {
  id: string
  documentId: string
  documentName: string
  signerEmail: string
  signerName: string
  status: 'pending' | 'signed' | 'declined' | 'expired'
  sentAt: string
  signedAt?: string
  ipAddress?: string
  auditTrail: SignatureAuditEntry[]
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-500',
  signed: 'bg-green-500/10 text-green-500',
  declined: 'bg-red-500/10 text-red-500',
  expired: 'bg-muted text-muted-foreground',
}

const ACTION_COLORS: Record<string, string> = {
  sent: 'text-blue-500',
  viewed: 'text-purple-500',
  signed: 'text-green-500',
  declined: 'text-red-500',
  expired: 'text-muted-foreground',
}

export default function EsignPage() {
  const [requests, setRequests] = useState<SignatureRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<SignatureRequest | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null)
  const [form, setForm] = useState({
    documentId: '',
    documentName: '',
    signerEmail: '',
    signerName: '',
  })

  useEffect(() => {
    let cancelled = false
    fetch('/api/v1/compliance/signatures')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => { if (!cancelled) setRequests(data.requests ?? []) })
      .catch(() => { if (!cancelled) toast.error('Failed to load signature requests') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.documentId || !form.documentName || !form.signerEmail || !form.signerName) {
      toast.error('Please fill in all fields')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/compliance/signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to create request'); return }
      toast.success('Signature request created')
      setNewDialogOpen(false)
      setForm({ documentId: '', documentName: '', signerEmail: '', signerName: '' })
      const refresh = await fetch('/api/v1/compliance/signatures')
      const refData = await refresh.json()
      if (refData.requests) setRequests(refData.requests)
    } catch {
      toast.error('Failed to create signature request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleViewDetail = async (request: SignatureRequest) => {
    setSelectedRequest(request)
    setDetailOpen(true)
    setVerifyResult(null)
    try {
      const res = await fetch(`/api/v1/compliance/signatures/${request.id}`)
      const data = await res.json()
      if (data.request) setSelectedRequest(data.request)
    } catch {
      toast.error('Failed to load request details')
    }
  }

  const handleVerify = async () => {
    if (!selectedRequest) return
    setVerifying(true)
    try {
      const res = await fetch(`/api/v1/compliance/signatures/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', userId: 'current' }),
      })
      const data = await res.json()
      setVerifyResult(data.verified?.length > 0 ? data.verified[0].valid : false)
    } catch {
      toast.error('Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  const handleSign = async () => {
    if (!selectedRequest) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/compliance/signatures/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sign', userId: 'current', ipAddress: '127.0.0.1' }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to sign'); return }
      toast.success('Document signed successfully')
      setDetailOpen(false)
      const refresh = await fetch('/api/v1/compliance/signatures')
      const refData = await refresh.json()
      if (refData.requests) setRequests(refData.requests)
    } catch {
      toast.error('Failed to sign document')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDecline = async () => {
    if (!selectedRequest) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/compliance/signatures/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline', userId: 'current', reason: 'Declined by signer' }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to decline'); return }
      toast.success('Signature declined')
      setDetailOpen(false)
      const refresh = await fetch('/api/v1/compliance/signatures')
      const refData = await refresh.json()
      if (refData.requests) setRequests(refData.requests)
    } catch {
      toast.error('Failed to decline signature')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20 text-teal-500">
            <Fingerprint className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">E-Signature &amp; Part 11 Compliance</h1>
            <p className="text-sm text-muted-foreground">FDA 21 CFR Part 11 compliant digital signatures</p>
          </div>
        </div>
        <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Signature Request
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Signature Request</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="flex flex-col gap-4 pt-2">
              <div className="flex flex-col gap-1.5">
                <Label>Document ID</Label>
                <Input
                  placeholder="e.g. DOC-2026-0042"
                  value={form.documentId}
                  onChange={(e) => setForm((f) => ({ ...f, documentId: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Document Name</Label>
                <Input
                  placeholder="e.g. Quality Agreement v2.1"
                  value={form.documentName}
                  onChange={(e) => setForm((f) => ({ ...f, documentName: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Signer Email</Label>
                <Input
                  type="email"
                  placeholder="signer@company.com"
                  value={form.signerEmail}
                  onChange={(e) => setForm((f) => ({ ...f, signerEmail: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Signer Name</Label>
                <Input
                  placeholder="e.g. John Smith"
                  value={form.signerName}
                  onChange={(e) => setForm((f) => ({ ...f, signerName: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setNewDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Request
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold text-foreground">{requests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-500">{requests.filter((r) => r.status === 'pending').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Signed</p>
                <p className="text-2xl font-bold text-green-500">{requests.filter((r) => r.status === 'signed').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-teal-500" />
              <div>
                <p className="text-sm text-muted-foreground">Part 11 Compliant</p>
                <p className="text-2xl font-bold text-teal-500">Yes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScrollText className="h-5 w-5 text-teal-500" />
            Signature Requests
          </CardTitle>
          <CardDescription>Click a row to view details and audit trail</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Signer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Signed At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    No signature requests yet
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((req) => (
                  <TableRow
                    key={req.id}
                    className="cursor-pointer hover:bg-secondary/20"
                    onClick={() => handleViewDetail(req)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{req.documentName}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{req.documentId}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{req.signerEmail}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn('text-xs capitalize', STATUS_COLORS[req.status])}>
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(req.sentAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {req.signedAt ? new Date(req.signedAt).toLocaleDateString() : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5 text-teal-500" />
              Signature Request Details
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-6 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Document</Label>
                  <p className="text-sm font-medium">{selectedRequest.documentName}</p>
                  <p className="text-xs text-muted-foreground">{selectedRequest.documentId}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <div className="mt-1">
                    <Badge variant="secondary" className={cn('text-xs capitalize', STATUS_COLORS[selectedRequest.status])}>
                      {selectedRequest.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Signer</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-sm">{selectedRequest.signerName}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedRequest.signerEmail}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Part 11 Compliance</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-xs',
                        selectedRequest.status === 'signed'
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <Shield className="mr-1 h-3 w-3" />
                      {selectedRequest.status === 'signed' ? 'Compliant' : 'N/A'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground text-xs flex items-center gap-1 mb-2">
                  <Eye className="h-3.5 w-3.5" />
                  Verify Signature
                </Label>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={handleVerify} disabled={verifying}>
                    {verifying && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                    Verify Integrity
                  </Button>
                  {verifyResult !== null && (
                    <div className="flex items-center gap-2">
                      {verifyResult ? (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Valid
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-red-500/10 text-red-500">
                          <XCircle className="mr-1 h-3 w-3" />
                          Invalid
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground text-xs flex items-center gap-1 mb-2">
                  <ScrollText className="h-3.5 w-3.5" />
                  Audit Trail
                </Label>
                <div className="space-y-2">
                  {selectedRequest.auditTrail.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No audit entries</p>
                  ) : (
                    selectedRequest.auditTrail.map((entry, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-lg bg-secondary/20 p-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary">
                          {entry.action === 'signed' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          ) : entry.action === 'declined' ? (
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                          ) : entry.action === 'viewed' ? (
                            <Eye className="h-3.5 w-3.5 text-purple-500" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className={cn('text-sm font-medium capitalize', ACTION_COLORS[entry.action])}>
                              {entry.action}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {entry.user} &middot; {entry.ipAddress}
                          </p>
                          <p className="text-xs text-muted-foreground">{entry.details}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {selectedRequest.status === 'pending' && (
                <div className="flex justify-end gap-2 border-t pt-4">
                  <Button variant="outline" onClick={handleDecline} disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Decline
                  </Button>
                  <Button onClick={handleSign} disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign Document
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
