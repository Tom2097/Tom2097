"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { CheckCircle2, XCircle, UserPlus, ArrowUpCircle, Loader2, ClipboardCheck, Sparkles } from "lucide-react"
import { useI18n } from "@/components/providers/i18n-provider"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"

interface HarOption {
  label: string
  value: string
  consequence?: string
}

interface AiRecommendation {
  action: string
  confidence: number
  rationale?: string
}

interface HumanActionRequest {
  id: string
  reason: string
  context_summary: string | null
  requested_of: string | null
  options: HarOption[]
  ai_recommendation: AiRecommendation | null
  trigger_class: "capability_gap" | "authority_gate"
  priority: "low" | "normal" | "high" | "urgent"
  due_at: string | null
  created_at: string
  status: string
}

interface TeamMember {
  id: string
  full_name: string | null
  email: string
}

const PRIORITY_STYLE: Record<string, string> = {
  urgent: "bg-destructive/10 text-destructive border-destructive/30",
  high: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  normal: "bg-primary/10 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground border-muted-foreground/20",
}

export default function ApprovalsPage() {
  const { t } = useI18n()
  const [requests, setRequests] = useState<HumanActionRequest[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<HumanActionRequest | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [delegateTarget, setDelegateTarget] = useState<HumanActionRequest | null>(null)
  const [delegateTo, setDelegateTo] = useState("")

  const fetchRequests = useCallback(async (cancelled?: { current: boolean }) => {
    try {
      const res = await fetch("/api/v1/hitl/requests")
      if (!res.ok) throw new Error("Failed to load requests")
      const data = await res.json()
      if (!cancelled?.current) setRequests(data.requests || [])
    } catch {
      if (!cancelled?.current) toast.error(t("approvals.page.loadFailed"))
    } finally {
      if (!cancelled?.current) setLoading(false)
    }
  }, [t])

  useEffect(() => {
    const cancelled = { current: false }
    const load = async () => {
      await fetchRequests(cancelled)
      try {
        const res = await fetch("/api/v1/auth/team/members")
        const data = res.ok ? await res.json() : { members: [] }
        if (!cancelled.current) setMembers(data.members || [])
      } catch {
        // Non-fatal -- the delegate picker just stays empty.
      }
    }
    load()
    return () => { cancelled.current = true }
  }, [fetchRequests])

  const act = useCallback(
    async (id: string, action: string, extra?: { reason?: string; delegateToUserId?: string }) => {
      setActingId(id)
      try {
        const res = await fetch(`/api/v1/hitl/requests/${id}/act`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...extra }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || t("approvals.page.actionFailed"))
        toast.success(t("approvals.page.actionRecorded"))
        setRequests((prev) => prev.filter((r) => r.id !== id))
        setRejectTarget(null)
        setRejectReason("")
        setDelegateTarget(null)
        setDelegateTo("")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("approvals.page.actionFailed"))
      } finally {
        setActingId(null)
      }
    },
    [t],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8 p-6 md:p-8">
      <AnimatedGroup>
        <div className="flex items-center gap-3 mb-2">
          <ClipboardCheck className="w-7 h-7 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">{t("approvals.page.title")}</h1>
        </div>
        <p className="text-muted-foreground">{t("approvals.page.subtitle")}</p>
      </AnimatedGroup>

      {requests.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-4 text-emerald-500" />
          <p className="font-medium text-foreground">{t("approvals.page.emptyTitle")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("approvals.page.emptyBody")}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <Card key={r.id} className="p-6">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={PRIORITY_STYLE[r.priority] ?? PRIORITY_STYLE.normal}>
                      {r.priority}
                    </Badge>
                    <Badge variant="outline">
                      {r.trigger_class === "authority_gate" ? t("approvals.page.authorityGate") : t("approvals.page.capabilityGap")}
                    </Badge>
                    {r.due_at && (
                      <span className="text-xs text-muted-foreground">
                        {t("approvals.page.due")} {new Date(r.due_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-foreground">{r.reason}</p>
                  {r.context_summary && <p className="text-sm text-muted-foreground">{r.context_summary}</p>}
                  {r.ai_recommendation && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3 mt-2">
                      <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                      <span>
                        {t("approvals.page.aiSuggests")} <strong>{r.ai_recommendation.action}</strong>
                        {" "}({Math.round(r.ai_recommendation.confidence * 100)}% {t("approvals.page.confidence")})
                        {r.ai_recommendation.rationale ? ` — ${r.ai_recommendation.rationale}` : ""}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="gap-2"
                    disabled={actingId === r.id}
                    onClick={() => act(r.id, "approve")}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {t("approvals.page.approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 text-destructive hover:text-destructive"
                    disabled={actingId === r.id}
                    onClick={() => setRejectTarget(r)}
                  >
                    <XCircle className="w-4 h-4" />
                    {t("approvals.page.reject")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    disabled={actingId === r.id}
                    onClick={() => setDelegateTarget(r)}
                  >
                    <UserPlus className="w-4 h-4" />
                    {t("approvals.page.delegate")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    disabled={actingId === r.id}
                    onClick={() => act(r.id, "escalate")}
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    {t("approvals.page.escalate")}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("approvals.page.rejectDialog.title")}</DialogTitle>
            <DialogDescription>{t("approvals.page.rejectDialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">{t("approvals.page.rejectDialog.reasonLabel")}</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              {t("approvals.page.rejectDialog.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || actingId === rejectTarget?.id}
              onClick={() => rejectTarget && act(rejectTarget.id, "reject", { reason: rejectReason })}
            >
              {t("approvals.page.rejectDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!delegateTarget} onOpenChange={(open) => !open && setDelegateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("approvals.page.delegateDialog.title")}</DialogTitle>
            <DialogDescription>{t("approvals.page.delegateDialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("approvals.page.delegateDialog.selectLabel")}</Label>
            <Select value={delegateTo} onValueChange={setDelegateTo}>
              <SelectTrigger>
                <SelectValue placeholder={t("approvals.page.delegateDialog.selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name || m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelegateTarget(null)}>
              {t("approvals.page.delegateDialog.cancel")}
            </Button>
            <Button
              disabled={!delegateTo || actingId === delegateTarget?.id}
              onClick={() => delegateTarget && act(delegateTarget.id, "delegate", { delegateToUserId: delegateTo })}
            >
              {t("approvals.page.delegateDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
