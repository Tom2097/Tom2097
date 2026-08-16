import { redirect } from 'next/navigation'
import { getTranslator } from "@/lib/i18n/server"
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { getDashboardStats, getRevenueMetrics, getOperationalMetrics, getRiskMetrics, getCommunicationVolume, getDocumentsProcessedThisMonth } from '@/lib/dashboard/queries'
import { listMonitors } from '@/lib/monitoring/engine'
import { detectAnomalies } from '@/lib/analytics/anomaly-detection'
import { forecastMetric } from '@/lib/analytics/forecasting'
import { LandingPage } from '@/components/digit/landing-page'
import DashboardContent from './dashboard-content'
import { ANNUAL_PRICE_CENTS, MONTHLY_PRICE_CENTS } from '@/lib/products'

export const dynamic = 'force-dynamic'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://digit-ai.org'

// Organization + SoftwareApplication structured data for the public marketing
// homepage -- gives search engines a machine-readable summary of who DigiT
// is and what it costs, for rich results (pricing snippets, knowledge panel).
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'DigiT',
      url: siteUrl,
      logo: `${siteUrl}/icon.svg`,
    },
    {
      '@type': 'SoftwareApplication',
      name: 'DigiT',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: 'DigiT is an intelligent enterprise operations platform that learns from your business, automates workflows, and enables better decision-making.',
      offers: [
        {
          '@type': 'Offer',
          name: 'Annual',
          price: (ANNUAL_PRICE_CENTS / 100).toFixed(2),
          priceCurrency: 'USD',
          url: `${siteUrl}/checkout`,
        },
        {
          '@type': 'Offer',
          name: 'Monthly',
          price: (MONTHLY_PRICE_CENTS / 100).toFixed(2),
          priceCurrency: 'USD',
          url: `${siteUrl}/checkout`,
        },
      ],
    },
  ],
}

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    // "/" is the one page in the app a signed-out visitor actually reaches
    // (every other page redirects to /auth/login before rendering) -- so
    // it doubles as the public marketing homepage instead of bouncing
    // straight to the login form.
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <LandingPage />
      </>
    )
  }

  const serviceDb = createServiceClient()
  const { data: profile, error: profileErr } = await serviceDb
    .from("profiles")
    .select("organization_id, role, onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle()
  if (!profile) {
    return <Err msg="Profile not found" detail={profileErr?.message} uid={user.id} />
  }

  // Brand-new self-signups are meant to see the /onboarding questionnaire
  // before the dashboard (app/auth/callback/route.ts redirects there
  // directly when it can), but the standard email-confirmation flow signs
  // the user out before a redirect there is possible -- so this is the real
  // gate: anyone who reaches the dashboard without having completed
  // onboarding gets sent there instead. Invited users have
  // onboarding_completed_at set at profile-creation time, so they're never
  // redirected. Existing accounts from before this flag existed are
  // backfilled (see the 20260824000001 migration) so this never re-triggers
  // for already-onboarded users.
  if (!profile.onboarding_completed_at) {
    redirect("/onboarding")
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
  const [stats, revenueData, operationalData, riskData, forecastData, anomalies, subResult, monitorsResult, communicationVolume, documentsProcessed] = await Promise.all([
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
    getCommunicationVolume(orgId),
    getDocumentsProcessedThisMonth(orgId),
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
      communicationVolume={communicationVolume}
      documentsProcessed={documentsProcessed}
    />
  )
}
