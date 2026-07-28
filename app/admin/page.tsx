"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MetricCard, MetricGrid } from "@/components/digit/metric-card"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"
import { InView } from "@/components/motion-primitives/in-view"
import {
  Building2,
  Users,
  Mail,
  DollarSign,
  Plus,
  UserCheck,
  ScrollText,
  ArrowRight,
  Activity,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react"

interface TenantReg {
  id: string
  name: string
  plan: string
  status: string
  createdAt: string
  userCount: number
}

interface SystemHealth {
  status: "healthy" | "degraded" | "outage"
  uptime: number
  activeAlerts: number
  monitoredServices: number
  lastIncident: string | null
}

function monthsAgo(n: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d
}

export default function AdminDashboardPage() {
  const { t } = useI18n()
  const [stats, setStats] = useState({ tenants: 0, users: 0, revenue: 0, tenantChange: 0, userChange: 0, revenueChange: 0 })
  const [recentTenants, setRecentTenants] = useState<TenantReg[]>([])
  const [loading, setLoading] = useState(true)
  const [health, setHealth] = useState<SystemHealth>({ status: "healthy", uptime: 100, activeAlerts: 0, monitoredServices: 0, lastIncident: null })

  useEffect(() => {
    async function load() {
      try {
        const [tenantsRes, revenueRes, monitoringRes] = await Promise.all([
          fetch("/api/v1/admin/tenants"),
          fetch("/api/v1/admin/revenue"),
          fetch("/api/v1/admin/monitoring"),
        ])

        if (tenantsRes.ok) {
          const data = await tenantsRes.json()
          const tenants: TenantReg[] = data.tenants || []
          setRecentTenants(
            [...tenants].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5),
          )

          const thisMonth = monthsAgo(1)
          const lastMonth = monthsAgo(2)
          const tenantsThisMonth = tenants.filter((tn) => new Date(tn.createdAt) >= thisMonth).length
          const tenantsLastMonth = tenants.filter((tn) => new Date(tn.createdAt) >= lastMonth && new Date(tn.createdAt) < thisMonth).length
          const tenantChange = tenantsLastMonth > 0 ? Math.round(((tenantsThisMonth - tenantsLastMonth) / tenantsLastMonth) * 100) : 0

          const users = tenants.reduce((sum, tn) => sum + (tn.userCount || 0), 0)
          const usersThisMonth = tenants.filter((tn) => new Date(tn.createdAt) >= thisMonth).reduce((sum, tn) => sum + (tn.userCount || 0), 0)
          const usersLastMonth = tenants.filter((tn) => new Date(tn.createdAt) >= lastMonth && new Date(tn.createdAt) < thisMonth).reduce((sum, tn) => sum + (tn.userCount || 0), 0)
          const userChange = usersLastMonth > 0 ? Math.round(((usersThisMonth - usersLastMonth) / usersLastMonth) * 100) : 0

          setStats((prev) => ({ ...prev, tenants: tenants.length, users, tenantChange, userChange }))
        }

        if (revenueRes.ok) {
          const data = await revenueRes.json()
          setStats((prev) => ({ ...prev, revenue: data.metrics?.mrr ?? 0, revenueChange: data.metrics?.mrrChange ?? 0 }))
        }

        if (monitoringRes.ok) {
          const data = await monitoringRes.json()
          const worst = data.services?.find((s: { status: string }) => s.status === "critical")
            ?? data.services?.find((s: { status: string }) => s.status === "warning")
          setHealth({
            status: worst ? (worst.status === "critical" ? "outage" : "degraded") : "healthy",
            uptime: data.uptime ?? 100,
            activeAlerts: data.activeAlerts ?? 0,
            monitoredServices: data.services?.length ?? 0,
            lastIncident: data.recentErrors?.[0]?.timestamp ? new Date(data.recentErrors[0].timestamp).toLocaleDateString() : null,
          })
        }
      } catch {
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const trendOf = (change: number): "up" | "down" | "stable" => (change > 0 ? "up" : change < 0 ? "down" : "stable")

  const getStatusBadge = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      suspended: "destructive",
      trialing: "secondary",
      deprovisioned: "outline",
    }
    return <Badge variant={map[status] || "outline"}>{status}</Badge>
  }

  return (
    <div className="space-y-6">
      <AnimatedGroup className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("admin.page.admin_dashboard")}</h1>
            <p className="text-muted-foreground">{t("admin.page.platformwide_overview_and_management")}</p>
          </div>
        </div>

        <MetricGrid>
          <MetricCard label="Total Tenants" value={loading ? "..." : stats.tenants} trend={trendOf(stats.tenantChange)} change={stats.tenantChange} />
          <MetricCard label="Active Users" value={loading ? "..." : stats.users} trend={trendOf(stats.userChange)} change={stats.userChange} />
          <MetricCard label="Active Alerts" value={loading ? "..." : health.activeAlerts} trend={health.activeAlerts > 0 ? "down" : "stable"} />
          <MetricCard label="Revenue (MTD)" value={loading ? "..." : `$${stats.revenue.toLocaleString()}`} trend={trendOf(stats.revenueChange)} change={stats.revenueChange} />
        </MetricGrid>
      </AnimatedGroup>

      <div className="grid gap-6 lg:grid-cols-3">
        <InView delay={0} className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.page.recent_tenant_registrations")}</CardTitle>
            <CardDescription>{t("admin.page.latest_organizations_to_join_the_platform")}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">{t("predictiveMaintenance.page.loading")}</div>
            ) : recentTenants.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">{t("admin.page.no_tenants_registered_yet")}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.page.organization")}</TableHead>
                    <TableHead>{t("dashboard.subscription.active.planSuffix")}</TableHead>
                    <TableHead>{t("resources.page.status")}</TableHead>
                    <TableHead>{t("admin.page.users")}</TableHead>
                    <TableHead>{t("bulk.page.created")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTenants.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell><Badge variant="outline">{t.plan}</Badge></TableCell>
                      <TableCell>{getStatusBadge(t.status)}</TableCell>
                      <TableCell>{t.userCount}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="mt-4">
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/tenants">
                  View All Tenants
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        </InView>

        <InView delay={0.08}>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                {health.status === "healthy" ? (
                  <ShieldCheck className="h-8 w-8 text-emerald-500" />
                ) : health.status === "degraded" ? (
                  <AlertTriangle className="h-8 w-8 text-amber-500" />
                ) : (
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                )}
                <div>
                  <p className="font-medium capitalize">{health.status}</p>
                  <p className="text-sm text-muted-foreground">{health.uptime}% uptime</p>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("admin.page.monitored_services")}</span>
                  <span className="font-medium">{health.monitoredServices}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("admin.page.last_incident")}</span>
                  <span className="font-medium">{health.lastIncident || "None"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("dsar.page.tabs.quickActions")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link href="/admin/tenants">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Tenant
                </Link>
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link href="/admin/impersonation">
                  <UserCheck className="mr-2 h-4 w-4" />
                  Impersonate User
                </Link>
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link href="/admin/security">
                  <ScrollText className="mr-2 h-4 w-4" />
                  View Audit Log
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
        </InView>
      </div>
    </div>
  )
}
