import { getTranslator } from "@/lib/i18n/server"
import { isCurrentUserPlatformOwner } from "@/lib/platform/owner"
import { createServiceClient } from "@/lib/supabase/service"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, AlertTriangle, CheckCircle2, Clock } from "lucide-react"
import { AuditRetention } from "@/components/digit/audit-retention"

export const dynamic = "force-dynamic"

async function getRecentAuditEvents() {
  const supabase = createServiceClient()
  const { data: events } = await supabase
    .from("audit_logs")
    .select("action, user_id, organization_id, created_at, metadata")
    .order("created_at", { ascending: false })
    .limit(50)

  return events || []
}

export default async function AdminSecurityPage() {
  const { t } = await getTranslator()
  const isOwner = await isCurrentUserPlatformOwner()
  if (!isOwner) notFound()

  const events = await getRecentAuditEvents()
  const failedEvents = events.filter((e: any) => e.action?.includes("failed") || e.action?.includes("denied"))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t("platformAdmin.security.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("platformAdmin.security.subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("platformAdmin.security.totalEvents")}</CardTitle>
            <Shield className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{events.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("platformAdmin.security.failedDenied")}</CardTitle>
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{failedEvents.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("platformAdmin.security.status")}</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-2">{t("platformAdmin.security.auditing")}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("platformAdmin.security.recentAuditEvents")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {events.map((event: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    event.action?.includes("failed") || event.action?.includes("denied")
                      ? "bg-destructive"
                      : "bg-chart-2"
                  }`} />
                  <div>
                    <p className="text-sm font-medium">{event.action}</p>
                    <p className="text-xs text-muted-foreground">
                      Organization: {event.organization_id?.substring(0, 8)}...
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(event.created_at).toLocaleString()}
                </span>
              </div>
            ))}
            {events.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("platformAdmin.security.noAuditEvents")}</p>
              </div>
            )}
          </div>
        </CardContent>
       </Card>
       <div className="mt-8">
         <AuditRetention />
       </div>
      </div>
    )
}
