"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { FileSignature, Plus, Loader2, Send } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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

interface SignatureRequest {
  id: string
  document_id: string
  document_name: string
  signer_email: string
  signer_name: string | null
  status: "pending" | "sent" | "viewed" | "signed" | "rejected" | "expired"
  expires_at: string | null
  signed_at: string | null
  created_at: string
}

interface DocOption {
  id: string
  name: string
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-600",
  sent: "bg-blue-500/20 text-blue-600",
  viewed: "bg-cyan-500/20 text-cyan-600",
  signed: "bg-chart-2/20 text-chart-2",
  rejected: "bg-red-500/20 text-red-600",
  expired: "bg-muted text-muted-foreground",
}

export function ComplianceESignatures() {
  const [requests, setRequests] = useState<SignatureRequest[]>([])
  const [documents, setDocuments] = useState<DocOption[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ documentId: "", signerEmail: "", signerName: "", message: "" })
  const [submitting, setSubmitting] = useState(false)

  const fetchRequests = async () => {
    try {
      const res = await fetch("/api/v1/compliance/esignatures")
      if (res.ok) {
        const data = await res.json()
        setRequests(Array.isArray(data.requests) ? data.requests : [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
    fetch("/api/v1/documents?limit=100")
      .then((res) => (res.ok ? res.json() : { documents: [] }))
      .then((data) => setDocuments((data.documents ?? []).map((d: { id: string; name: string }) => ({ id: d.id, name: d.name }))))
      .catch(() => {})
  }, [])

  const handleCreate = async () => {
    const doc = documents.find((d) => d.id === form.documentId)
    if (!doc || !form.signerEmail.trim()) return
    setSubmitting(true)
    try {
      await fetch("/api/v1/compliance/esignatures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: doc.id,
          documentName: doc.name,
          signerEmail: form.signerEmail.trim(),
          signerName: form.signerName.trim() || null,
          message: form.message.trim() || null,
        }),
      })
      setAddOpen(false)
      setForm({ documentId: "", signerEmail: "", signerName: "", message: "" })
      fetchRequests()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-6 border-border/50 bg-card/50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-foreground">E-Signatures</h3>
          <p className="text-sm text-muted-foreground">Request and track document signatures, 21 CFR Part 11 compliant</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Request Signature</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request a Signature</DialogTitle>
              <DialogDescription>Send a document to be signed electronically</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Document</Label>
                <Select value={form.documentId} onValueChange={(v) => setForm((p) => ({ ...p, documentId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select a document" /></SelectTrigger>
                  <SelectContent>
                    {documents.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {documents.length === 0 && (
                  <p className="text-xs text-muted-foreground">No documents available yet — upload one first</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Signer Email</Label>
                <Input
                  type="email"
                  value={form.signerEmail}
                  onChange={(e) => setForm((p) => ({ ...p, signerEmail: e.target.value }))}
                  placeholder="signer@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Signer Name</Label>
                <Input
                  value={form.signerName}
                  onChange={(e) => setForm((p) => ({ ...p, signerName: e.target.value }))}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="space-y-2">
                <Label>Message (optional)</Label>
                <Textarea
                  value={form.message}
                  onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                  rows={2}
                  placeholder="Please review and sign at your earliest convenience"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!form.documentId || !form.signerEmail.trim() || submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Send Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileSignature className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No signature requests yet</p>
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
                <p className="text-sm font-medium text-foreground">{req.document_name}</p>
                <p className="text-xs text-muted-foreground">
                  {req.signer_name ? `${req.signer_name} · ` : ""}{req.signer_email}
                </p>
              </div>
              <Badge variant="secondary" className={statusColors[req.status]}>{req.status}</Badge>
            </motion.div>
          ))}
        </div>
      )}
    </Card>
  )
}
