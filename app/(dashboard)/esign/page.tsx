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
import { useI18n } from '@/components/providers/i18n-provider'
import { AnimatedGroup } from '@/components/motion-primitives/animated-group'

interface SignatureAuditEntry {
  timestamp: string
  action: string
  user: string
  ipAddress: string
  details: string
}

interface SignatureRequest {
  id: string
  document_id: string
  document_name: string
  signer_email: string
  signer_name: string | null
  status: 'pending' | 'sent' | 'viewed' | 'signed' | 'rejected' | 'expired'
  created_at: string
  signed_at?: string | null
  signed_ip?: string | null
  auditTrail: SignatureAuditEntry[]
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-500',
  sent: 'bg-blue-500/10 text-blue-500',
  viewed: 'bg-purple-500/10 text-purple-500',
  signed: 'bg-green-500/10 text-green-500',
  rejected: 'bg-red-500/10 text-red-500',
  expired: 'bg-muted text-muted-foreground',
}

const ACTION_COLORS: Record<string, string> = {
  create: 'text-blue-500',
  sent: 'text-blue-500',
  viewed: 'text-purple-500',
  sign: 'text-green-500',
  signed: 'text-green-500',
  update: 'text-red-500',
  rejected: 'text-red-500',
  verify: 'text-cyan-500',
  expired: 'text-muted-foreground',
}

export default function EsignPage() {
  const { t } = useI18n()
  const [requests, setRequests] = useState<SignatureRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<SignatureRequest | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null)
  const [signatureName, setSignatureName] = useState('')
  const [form, setForm] = useState({
    documentId: '',
    documentName: '',
    signerEmail: '',
    signerName: '',
  })

  useEffect(() => {
    let cancelled = false
    fetch('/api/v1/compliance/esignatures')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => { if (!cancelled) setRequests(data.requests ?? []) })
      .catch(() => { if (!cancelled) toast.error(t('esign.page.errors.loadFailed')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [t])

  const refreshList = async () => {
    const refresh = await fetch('/api/v1/compliance/esignatures')
    const refData = await refresh.json()
    if (refData.requests) setRequests(refData.requests)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.documentId || !form.documentName || !form.signerEmail || !form.signerName) {
      toast.error(t('esign.page.errors.fillAllFields'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/compliance/esignatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? t('esign.page.errors.createFailed')); return }
      toast.success(t('esign.page.success.created'))
      setNewDialogOpen(false)
      setForm({ documentId: '', documentName: '', signerEmail: '', signerName: '' })
      await refreshList()
    } catch {
      toast.error(t('esign.page.errors.createFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleViewDetail = async (request: SignatureRequest) => {
    setSelectedRequest(request)
    setDetailOpen(true)
    setVerifyResult(null)
    setSignatureName('')
    try {
      const res = await fetch(`/api/v1/compliance/esignatures/${request.id}`)
      const data = await res.json()
      if (data.request) setSelectedRequest(data.request)
    } catch {
      toast.error(t('esign.page.errors.loadDetailsFailed'))
    }
  }

  const handleVerify = async () => {
    if (!selectedRequest) return
    setVerifying(true)
    try {
      const res = await fetch(`/api/v1/compliance/esignatures/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
      })
      const data = await res.json()
      setVerifyResult(Boolean(data.valid))
    } catch {
      toast.error(t('esign.page.errors.verifyFailed'))
    } finally {
      setVerifying(false)
    }
  }

  const handleSign = async () => {
    if (!selectedRequest || !signatureName.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/compliance/esignatures/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sign', signatureData: signatureName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? t('esign.page.errors.signFailed')); return }
      toast.success(t('esign.page.success.signed'))
      setDetailOpen(false)
      await refreshList()
    } catch {
      toast.error(t('esign.page.errors.signFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDecline = async () => {
    if (!selectedRequest) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/compliance/esignatures/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason: 'Declined by signer' }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? t('esign.page.errors.declineFailed')); return }
      toast.success(t('esign.page.success.declined'))
      setDetailOpen(false)
      await refreshList()
    } catch {
      toast.error(t('esign.page.errors.declineFailed'))
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
      <AnimatedGroup className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20 text-teal-500">
            <Fingerprint className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('esign.page.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('esign.page.subtitle')}</p>
          </div>
        </div>
        <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t('esign.page.newSignatureRequest')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('esign.page.dialogTitle')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="flex flex-col gap-4 pt-2">
              <div className="flex flex-col gap-1.5">
                <Label>{t('esign.page.documentId')}</Label>
                <Input
                  placeholder={t('esign.page.documentIdPlaceholder')}
                  value={form.documentId}
                  onChange={(e) => setForm((f) => ({ ...f, documentId: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('esign.page.documentName')}</Label>
                <Input
                  placeholder={t('esign.page.documentNamePlaceholder')}
                  value={form.documentName}
                  onChange={(e) => setForm((f) => ({ ...f, documentName: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('esign.page.signerEmail')}</Label>
                <Input
                  type="email"
                  placeholder={t('esign.page.signerEmailPlaceholder')}
                  value={form.signerEmail}
                  onChange={(e) => setForm((f) => ({ ...f, signerEmail: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('esign.page.signerName')}</Label>
                <Input
                  placeholder={t('esign.page.signerNamePlaceholder')}
                  value={form.signerName}
                  onChange={(e) => setForm((f) => ({ ...f, signerName: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setNewDialogOpen(false)}>{t('esign.page.cancel')}</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('esign.page.sendRequest')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </AnimatedGroup>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">{t('esign.page.totalRequests')}</p>
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
                <p className="text-sm text-muted-foreground">{t('esign.page.pending')}</p>
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
                <p className="text-sm text-muted-foreground">{t('esign.page.signed')}</p>
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
                <p className="text-sm text-muted-foreground">{t('esign.page.part11Compliant')}</p>
                <p className="text-2xl font-bold text-teal-500">{t('esign.page.yes')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScrollText className="h-5 w-5 text-teal-500" />
            {t('esign.page.signatureRequests')}
          </CardTitle>
          <CardDescription>{t('esign.page.clickRow')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('esign.page.document')}</TableHead>
                <TableHead>{t('esign.page.signer')}</TableHead>
                <TableHead>{t('esign.page.status')}</TableHead>
                <TableHead>{t('esign.page.sent')}</TableHead>
                <TableHead>{t('esign.page.signedAt')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    {t('esign.page.noRequests')}
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
                        <span className="font-medium">{req.document_name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{req.document_id}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{req.signer_email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn('text-xs capitalize', STATUS_COLORS[req.status])}>
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(req.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {req.signed_at ? new Date(req.signed_at).toLocaleDateString() : '-'}
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
              {t('esign.page.requestDetails')}
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-6 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">{t('esign.page.document')}</Label>
                  <p className="text-sm font-medium">{selectedRequest.document_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedRequest.document_id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">{t('esign.page.status')}</Label>
                  <div className="mt-1">
                    <Badge variant="secondary" className={cn('text-xs capitalize', STATUS_COLORS[selectedRequest.status])}>
                      {selectedRequest.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">{t('esign.page.signer')}</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-sm">{selectedRequest.signer_name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedRequest.signer_email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">{t('esign.page.part11Status')}</Label>
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
                      {selectedRequest.status === 'signed' ? t('esign.page.compliant') : t('esign.page.na')}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground text-xs flex items-center gap-1 mb-2">
                  <Eye className="h-3.5 w-3.5" />
                  {t('esign.page.verifySignature')}
                </Label>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={handleVerify} disabled={verifying}>
                    {verifying && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                    {t('esign.page.verifyIntegrity')}
                  </Button>
                  {verifyResult !== null && (
                    <div className="flex items-center gap-2">
                      {verifyResult ? (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          {t('esign.page.valid')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-red-500/10 text-red-500">
                          <XCircle className="mr-1 h-3 w-3" />
                          {t('esign.page.invalid')}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground text-xs flex items-center gap-1 mb-2">
                  <ScrollText className="h-3.5 w-3.5" />
                  {t('esign.page.auditTrail')}
                </Label>
                <div className="space-y-2">
                  {selectedRequest.auditTrail.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">{t('esign.page.noAuditEntries')}</p>
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

              {['pending', 'sent', 'viewed'].includes(selectedRequest.status) && (
                <div className="space-y-3 border-t pt-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Type your full name to sign</Label>
                    <Input
                      placeholder={selectedRequest.signer_name ?? 'Your full name'}
                      value={signatureName}
                      onChange={(e) => setSignatureName(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleDecline} disabled={submitting}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t('esign.page.decline')}
                    </Button>
                    <Button onClick={handleSign} disabled={submitting || !signatureName.trim()}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t('esign.page.signDocument')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
