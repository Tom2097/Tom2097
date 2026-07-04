import { isCurrentUserPlatformOwner } from "@/lib/platform/owner"
import { getPlatformCapacityReport } from "@/lib/platform/capacity-service"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Users, CreditCard, Activity, Shield, AlertTriangle } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AdminDashboardPage() {
  const isOwner = await isCurrentUserPlatformOwner()
  if (!isOwner) notFound()

  const report = await getPlatformCapacityReport()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Platform-wide overview and management</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tenants</CardTitle>
            <Building2 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{report.totals.companies}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Limit: {report.limits.maxTenants}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{report.totals.users}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Limit: {report.limits.maxUsers}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Subscriptions</CardTitle>
            <CreditCard className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{report.totals.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              MRR: ${report.totals.mrr?.toLocaleString() || "0"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Platform Health</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-2">Healthy</div>
            <p className="text-xs text-muted-foreground mt-1">
              Updated {new Date(report.generatedAt).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <a href="/platform/admin/tenants" className="flex items-center gap-3 p-4 rounded-lg border border-border/50 hover:border-primary/50 transition-colors">
            <Building2 className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Manage Tenants</p>
              <p className="text-xs text-muted-foreground">View and manage all organizations</p>
            </div>
          </a>
          <a href="/platform/admin/users" className="flex items-center gap-3 p-4 rounded-lg border border-border/50 hover:border-primary/50 transition-colors">
            <Users className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium">User Management</p>
              <p className="text-xs text-muted-foreground">View and manage platform users</p>
            </div>
          </a>
          <a href="/platform/admin/security" className="flex items-center gap-3 p-4 rounded-lg border border-border/50 hover:border-primary/50 transition-colors">
            <Shield className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Security Center</p>
              <p className="text-xs text-muted-foreground">Audit logs and security events</p>
            </div>
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
