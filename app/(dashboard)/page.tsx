import { getTranslator } from "@/lib/i18n/server"
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { getDashboardStats, getRevenueMetrics, getOperationalMetrics, getRiskMetrics } from '@/lib/dashboard/queries'
import { listMonitors } from '@/lib/monitoring/engine'
import { detectAnomalies } from '@/lib/analytics/anomaly-detection'
import { forecastMetric } from '@/lib/analytics/forecasting'
import DashboardContent from './dashboard-content'

export const dynamic = 'force-dynamic'

async function Err({ msg, detail, uid, oid }: { msg: string; detail?: string; uid?: string; oid?: string }) {
  const { t } = await getTranslator()
  return (
    <div style={{background:"#111",color:"#f44",padding:40,fontFamily:"monospace",minHeight:"100vh"}}>
      <h1 style={{fontSize:24,marginBottom:16}}>{t("dashboard.page.authError", { msg })}</h1>
      {detail && <p>{t("dashboard.page.detail", { detail })}</p>}
      {uid && <p>{t("dashboard.page.user", { uid })}</p>}
      {oid && <p>{t("dashboard.page.org", { oid })}</p>}
      <div style={{marginTop:20}}>
        <a href="/login-check" style={{color:"#0ff"}}>{t("dashboard.page.goToLoginCheck")}</a>
        {' | '}
        <a href="/auth/login" style={{color:"#0ff"}}>{t("dashboard.page.backToLogin")}</a>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const { t } = await getTranslator()
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (!user) {
    return <Err msg="getUser returned null" detail={userErr?.message} />
  }

  const serviceDb = createServiceClient()
  const { data: profile, error: profileErr } = await serviceDb
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .maybeSingle()
  if (!profile) {
    return <Err msg="Profile not found" detail={profileErr?.message} uid={user.id} />
  }

  const { data: org, error: orgErr } = await serviceDb
    .from("organizations")
    .select("name, slug, created_at")
    .eq("id", profile.organization_id)
    .maybeSingle()
  if (!org) {
    return <Err msg="Org not found" detail={orgErr?.message} oid={profile.organization_id} />
  }

  const orgId = profile.organization_id
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const db = createServiceClient()
  const [stats, revenueData, operationalData, riskData, forecastData, anomalies, subResult, monitorsResult] = await Promise.all([
    getDashboardStats(orgId),
    getRevenueMetrics(orgId),
    getOperationalMetrics(orgId),
    getRiskMetrics(orgId),
    forecastMetric(orgId, 'revenue', 6),
    detectAnomalies(orgId, 'revenue', { start: thirtyDaysAgo.toISOString(), end: now.toISOString() }),
    db
      .from('subscriptions')
      .select('plan_id, status, current_period_end')
      .eq('organization_id', orgId)
      .maybeSingle(),
    listMonitors(orgId, { enabledOnly: true, limit: 4 }).catch(() => ({ monitors: [], total: 0 })),
  ])

  const subscription = subResult.data as
    | { plan_id: string; status: string; current_period_end: string | null }
    | null

  return (
    <DashboardContent
      stats={stats}
      revenueData={revenueData}
      operationalData={operationalData}
      riskData={riskData}
      forecastData={forecastData}
      anomalies={anomalies}
      subscription={subscription}
      operations={monitorsResult.monitors}
      activeOperationsCount={monitorsResult.total}
    />
  )
}
