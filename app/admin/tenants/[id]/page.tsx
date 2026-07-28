"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import {
  Building2,
  PauseCircle,
  Send,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Mail,
  Calendar,
  CreditCard,
  Users,
  Settings2,
} from "lucide-react"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"
import { InView } from "@/components/motion-primitives/in-view"

interface TenantDetail {
  id: string
  name: string
  plan: string
  status: string
  created_at: string
  email?: string
  subscriptions: Array<{
    plan_id: string
    status: string
    billing_period_start?: string
    billing_period_end?: string
    payment_provider?: string
    trial_end?: string
  }>
  profiles: Array<{
    id: string
    email: string
    full_name: string
    role: string
    created_at: string
  }>
  workspace_config?: Record<string, unknown>
  activity?: Array<{ action: string; date: string; user: string }>
}

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = useI18n()
  const { id } = use(params)
  const [tenant, setTenant] = useState<TenantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false)
  const [suspendReason, setSuspendReason] = useState("")
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false)
  const [notifySubject, setNotifySubject] = useState("")
  const [notifyMessage, setNotifyMessage] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/v1/admin/tenants?id=${id}`)
        if (res.ok) {
          const data = await res.json()
          setTenant(data.tenant)
        }
      } catch {
        toast.error("Failed to load tenant details")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const handleSuspend = async () => {
    if (!tenant) return
    try {
      const res = await fetch("/api/v1/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suspend", tenantId: tenant.id, reason: suspendReason }),
      })
      if (res.ok) {
        toast.success("Tenant suspended")
        setSuspendDialogOpen(false)
        setSuspendReason("")
        setTenant({ ...tenant, status: "suspended" })
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to suspend tenant")
      }
    } catch {
      toast.error("Failed to suspend tenant")
    }
  }

  const handleSendNotification = async () => {
    if (!tenant || !notifySubject || !notifyMessage) return
    try {
      const res = await fetch("/api/v1/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          subject: notifySubject,
          message: notifyMessage,
        }),
      })
      if (res.ok) {
        toast.success("Notification sent")
        setNotifyDialogOpen(false)
        setNotifySubject("")
        setNotifyMessage("")
      } else {
        toast.error("Failed to send notification")
      }
    } catch {
      toast.error("Failed to send notification")
    }
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      trialing: "secondary",
      suspended: "destructive",
      deprovisioned: "outline",
    }
    return <Badge variant={map[status] || "outline"}>{status}</Badge>
  }

  const formatDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : "N/A")

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">{t("admin.tenantDetail.loading_tenant_details")}</div>
  }

  if (!tenant) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Building2 className="mx-auto h-12 w-12 text-muted-foreground/30" />
        <p className="mt-4 font-medium">{t("admin.tenantDetail.tenant_not_found")}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/admin/tenants">{t("admin.tenantDetail.back_to_tenants")}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AnimatedGroup>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{tenant.name}</h1>
                {getStatusBadge(tenant.status)}
              </div>
              <p className="text-sm text-muted-foreground">Created {formatDate(tenant.created_at)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {tenant.status !== "suspended" && tenant.status !== "deprovisioned" && (
              <Button variant="destructive" size="sm" onClick={() => setSuspendDialogOpen(true)}>
                <PauseCircle className="mr-2 h-4 w-4" />
                Suspend Tenant
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setNotifyDialogOpen(true)}>
              <Send className="mr-2 h-4 w-4" />
              Send Notification
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/?tenant=${tenant.id}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View as User
              </Link>
            </Button>
          </div>
        </div>
      </AnimatedGroup>

      <InView delay={0}>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(tenant.subscriptions || []).length > 0 ? (
              tenant.subscriptions.map((sub, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("dashboard.subscription.active.planSuffix")}</span>
                    <span className="font-medium capitalize">{sub.plan_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("resources.page.status")}</span>
                    {getStatusBadge(sub.status)}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("admin.tenantDetail.billing_period")}</span>
                    <span>{sub.billing_period_start ? `${formatDate(sub.billing_period_start)} - ${formatDate(sub.billing_period_end)}` : "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("admin.tenantDetail.payment_provider")}</span>
                    <span>{sub.payment_provider || "N/A"}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">{t("admin.tenantDetail.no_subscription_data")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Team Members
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(tenant.profiles || []).length > 0 ? (
              tenant.profiles.map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {(p.full_name || "U").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.full_name || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{p.role}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">{t("admin.tenantDetail.no_team_members")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="h-4 w-4" />
              Workspace Config
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {tenant.workspace_config ? (
              Object.entries(tenant.workspace_config as Record<string, unknown>).map(([key, val]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                  <span className="font-medium">{String(val)}</span>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">{t("admin.tenantDetail.no_workspace_configuration")}</p>
            )}
          </CardContent>
        </Card>
      </div>
      </InView>

      <InView delay={0.08}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!tenant.activity || tenant.activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("admin.tenantDetail.no_activity_yet")}</p>
            ) : (
              tenant.activity.map((event, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{event.action}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{event.user}</span>
                      <span>{t("admin.tenantDetail.middot")}</span>
                      <span>{new Date(event.date).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
      </InView>

      <AlertDialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend {tenant.name}</AlertDialogTitle>
            <AlertDialogDescription>
              This will suspend the tenant and mark their subscription as past due. Users will lose access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>{t("admin.tenantDetail.reason")}</Label>
            <Textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Reason for suspension..."
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSuspend} disabled={!suspendReason}>
              Suspend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={notifyDialogOpen} onOpenChange={setNotifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Notification to {tenant.name}</DialogTitle>
            <DialogDescription>{t("admin.tenantDetail.send_an_email_notification_to_all_tenant_admins")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("crm.communicationHub.subjectPlaceholder")}</Label>
              <Input
                value={notifySubject}
                onChange={(e) => setNotifySubject(e.target.value)}
                placeholder="Notification subject"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.tenantDetail.message")}</Label>
              <Textarea
                value={notifyMessage}
                onChange={(e) => setNotifyMessage(e.target.value)}
                placeholder="Type your message..."
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendNotification} disabled={!notifySubject || !notifyMessage}>
              <Send className="mr-2 h-4 w-4" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
