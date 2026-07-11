"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import {
  Search,
  Building2,
  Download,
  MoreHorizontal,
  Eye,
  PauseCircle,
  PlayCircle,
  Trash2,
  ArrowUpDown,
} from "lucide-react"

interface Tenant {
  id: string
  name: string
  plan: string
  status: "active" | "suspended" | "trialing" | "deprovisioned"
  userCount: number
  createdAt: string
  email?: string
}

interface TenantDetail {
  id: string
  name: string
  plan: string
  status: string
  created_at: string
  subscriptions: Array<{
    plan_id: string
    status: string
    billing_period_start?: string
    billing_period_end?: string
    payment_provider?: string
  }>
  profiles: Array<{
    id: string
    email: string
    full_name: string
    role: string
    created_at: string
  }>
}

export default function TenantsPage() {
  const { t } = useI18n()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detailTenant, setDetailTenant] = useState<TenantDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false)
  const [suspendTenantId, setSuspendTenantId] = useState<string | null>(null)
  const [suspendReason, setSuspendReason] = useState("")

  const [deprovisionDialogOpen, setDeprovisionDialogOpen] = useState(false)
  const [deprovisionTenantId, setDeprovisionTenantId] = useState<string | null>(null)

  const fetchTenants = useCallback(async (cancelled?: { current: boolean }) => {
    try {
      const res = await fetch("/api/v1/admin/tenants")
      if (res.ok) {
        const data = await res.json()
        if (!cancelled || !cancelled.current) setTenants(data.tenants || [])
      }
    } catch {
      if (!cancelled || !cancelled.current) toast.error(t("admin.tenants.loadFailed"))
    }
  }, [])

  useEffect(() => {
    const cancelled = { current: false }
    ;(async () => {
      try {
        setLoading(true)
        await fetchTenants(cancelled)
      } finally {
        if (!cancelled.current) setLoading(false)
      }
    })()
    return () => { cancelled.current = true }
  }, [fetchTenants])

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.email && t.email.toLowerCase().includes(search.toLowerCase()))
  )

  const toggleAll = () => {
    if (selected.size === filteredTenants.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredTenants.map((t) => t.id)))
    }
  }

  const toggleOne = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const handleSuspend = async () => {
    if (!suspendTenantId) return
    try {
      const res = await fetch("/api/v1/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suspend", tenantId: suspendTenantId, reason: suspendReason }),
      })
      if (res.ok) {
        toast.success(t("admin.tenants.suspendedSuccess"))
        setSuspendDialogOpen(false)
        setSuspendReason("")
        setSuspendTenantId(null)
        fetchTenants()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to suspend tenant")
      }
    } catch {
      toast.error("Failed to suspend tenant")
    }
  }

  const handleActivate = async (tenantId: string) => {
    try {
      const res = await fetch("/api/v1/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate", tenantId }),
      })
      if (res.ok) {
        toast.success(t("admin.tenants.activatedSuccess"))
        fetchTenants()
      }
    } catch {
      toast.error("Failed to activate tenant")
    }
  }

  const handleDeprovision = async () => {
    if (!deprovisionTenantId) return
    try {
      const res = await fetch("/api/v1/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deprovision", tenantId: deprovisionTenantId }),
      })
      if (res.ok) {
        toast.success(t("admin.tenants.deprovisionedSuccess"))
        setDeprovisionDialogOpen(false)
        setDeprovisionTenantId(null)
        fetchTenants()
      }
    } catch {
      toast.error("Failed to deprovision tenant")
    }
  }

  const viewDetail = async (tenantId: string) => {
    try {
      const res = await fetch(`/api/v1/admin/tenants?id=${tenantId}`)
      if (res.ok) {
        const data = await res.json()
        setDetailTenant(data.tenant)
        setDetailOpen(true)
      }
    } catch {
      toast.error(t("admin.tenants.detailFailed"))
    }
  }

  const exportCsv = () => {
    const header = t("admin.tenants.csvHeader")
    const rows = filteredTenants.map((t) =>
      `"${t.name}","${t.plan}","${t.status}",${t.userCount},"${new Date(t.createdAt).toISOString()}"`
    )
    const csv = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = t("admin.tenants.csvFilename")
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t("admin.tenants.exportSuccess"))
  }

  const bulkSuspend = async () => {
    for (const id of selected) {
      await fetch("/api/v1/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suspend", tenantId: id, reason: "Bulk suspension" }),
      })
    }
    toast.success(`Suspended ${selected.size} tenant(s)`)
    setSelected(new Set())
    fetchTenants()
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.tenants.title")}</h1>
          <p className="text-muted-foreground">{t("admin.tenants.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <>
              <Button variant="destructive" size="sm" onClick={bulkSuspend}>
                <PauseCircle className="mr-2 h-4 w-4" />
                Suspend Selected ({selected.size})
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("admin.tenants.searchPlaceholder")}
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">{t("predictiveMaintenance.page.loading")}</div>
          ) : filteredTenants.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 font-medium">{t("admin.tenants.noTenants")}</p>
              <p className="text-sm">{search ? t("admin.tenants.trySearch") : t("admin.tenants.noTenantsRegistered")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size === filteredTenants.length && filteredTenants.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>{t("admin.tenants.organizationName")}</TableHead>
                  <TableHead>{t("admin.tenants.plan")}</TableHead>
                  <TableHead>{t("admin.tenants.status")}</TableHead>
                  <TableHead>{t("admin.tenants.userCount")}</TableHead>
                  <TableHead>{t("admin.tenants.createdDate")}</TableHead>
                  <TableHead className="w-24">{t("admin.tenants.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(tenant.id)}
                        onCheckedChange={() => toggleOne(tenant.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell><Badge variant="outline">{tenant.plan}</Badge></TableCell>
                    <TableCell>{getStatusBadge(tenant.status)}</TableCell>
                    <TableCell>{tenant.userCount}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => viewDetail(tenant.id)} title={t("admin.tenants.viewDetails")}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {tenant.status === "active" || tenant.status === "trialing" ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setSuspendTenantId(tenant.id)
                              setSuspendReason("")
                              setSuspendDialogOpen(true)
                            }}
                            title={t("admin.tenants.suspend")}
                          >
                            <PauseCircle className="h-4 w-4 text-amber-500" />
                          </Button>
                        ) : tenant.status === "suspended" ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleActivate(tenant.id)}
                            title={t("admin.tenants.activate")}
                          >
                            <PlayCircle className="h-4 w-4 text-emerald-500" />
                          </Button>
                        ) : null}
                        {tenant.status !== "deprovisioned" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setDeprovisionTenantId(tenant.id)
                              setDeprovisionDialogOpen(true)
                            }}
                            title={t("admin.tenants.deprovision")}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detailTenant?.name || "Tenant Details"}</DialogTitle>
            <DialogDescription>{t("admin.tenants.tenantDetailsDesc")}</DialogDescription>
          </DialogHeader>
          {detailTenant && (
            <Tabs defaultValue="subscription">
              <TabsList>
                <TabsTrigger value="subscription">{t("admin.tenants.subscription")}</TabsTrigger>
                <TabsTrigger value="users">Users ({detailTenant.profiles?.length || 0})</TabsTrigger>
              </TabsList>
              <TabsContent value="subscription" className="space-y-4">
                {(detailTenant.subscriptions || []).length > 0 ? (
                  detailTenant.subscriptions.map((sub, i) => (
                    <div key={i} className="rounded-lg border p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("admin.tenants.plan")}</span>
                        <span className="font-medium">{sub.plan_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("admin.tenants.status")}</span>
                        <Badge variant="outline">{sub.status}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("admin.tenants.billingPeriod")}</span>
                        <span>
                          {sub.billing_period_start
                            ? `${new Date(sub.billing_period_start).toLocaleDateString()} - ${new Date(sub.billing_period_end || "").toLocaleDateString()}`
                            : t("admin.tenants.na")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("admin.tenants.paymentProvider")}</span>
                        <span>{sub.payment_provider || t("admin.tenants.na")}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">{t("admin.tenants.noSubscriptionData")}</p>
                )}
              </TabsContent>
              <TabsContent value="users">
                {(detailTenant.profiles || []).length > 0 ? (
                  <ScrollArea className="h-64">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("resources.page.name")}</TableHead>
                          <TableHead>{t("crm.communicationHub.channels.email")}</TableHead>
                          <TableHead>{t("settings.team.inviteDialog.roleLabel")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailTenant.profiles.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{p.full_name || "Unnamed"}</TableCell>
                            <TableCell className="text-xs">{p.email}</TableCell>
                            <TableCell><Badge variant="outline">{p.role}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("admin.tenants.no_users_in_this_tenant")}</p>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.tenants.suspend_tenant")}</AlertDialogTitle>
            <AlertDialogDescription>
              This will suspend the tenant and mark their subscription as past due. Users will lose access.
              Provide a reason for this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>{t("admin.tenants.reasonLabel")}</Label>
            <Textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder={t("admin.tenants.reasonPlaceholder")}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSuspend} disabled={!suspendReason}>
              Suspend Tenant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deprovisionDialogOpen} onOpenChange={setDeprovisionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.tenants.deprovisionTenant")}</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently deprovision the tenant and cancel their subscription.
              This action cannot be undone. All data will be scheduled for deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeprovision} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deprovision
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
