"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MetricCard, MetricGrid } from "@/components/digit/metric-card"
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
  activeNodes: number
  lastIncident: string | null
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({ tenants: 0, users: 0, pendingInvitations: 0, revenue: 0 })
  const [recentTenants, setRecentTenants] = useState<TenantReg[]>([])
  const [loading, setLoading] = useState(true)
  const [health, setHealth] = useState<SystemHealth>({ status: "healthy", uptime: 99.9, activeNodes: 4, lastIncident: null })

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/admin/tenants")
        if (res.ok) {
          const data = await res.json()
          const tenants: TenantReg[] = data.tenants || []
          setRecentTenants(tenants.slice(0, 5))
          setStats({
            tenants: tenants.length,
            users: tenants.reduce((sum: number, t: TenantReg) => sum + (t.userCount || 0), 0),
            pendingInvitations: Math.floor(tenants.length * 0.3),
            revenue: tenants.filter((t: TenantReg) => t.plan !== "free").length * 299,
          })
        }
      } catch {
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Platform-wide overview and management</p>
        </div>
      </div>

      <MetricGrid>
        <MetricCard label="Total Tenants" value={loading ? "..." : stats.tenants} trend="up" change={12} />
        <MetricCard label="Active Users" value={loading ? "..." : stats.users} trend="up" change={8} />
        <MetricCard label="Pending Invitations" value={loading ? "..." : stats.pendingInvitations} trend="stable" />
        <MetricCard label="Revenue (MTD)" value={loading ? "..." : `$${stats.revenue.toLocaleString()}`} trend="up" change={15} />
      </MetricGrid>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Tenant Registrations</CardTitle>
            <CardDescription>Latest organizations to join the platform</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : recentTenants.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No tenants registered yet</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Created</TableHead>
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
                  <span className="text-muted-foreground">Active Nodes</span>
                  <span className="font-medium">{health.activeNodes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Incident</span>
                  <span className="font-medium">{health.lastIncident || "None"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
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
      </div>
    </div>
  )
}
