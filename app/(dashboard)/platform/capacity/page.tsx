import { notFound } from "next/navigation"
import { isCurrentUserPlatformOwner } from "@/lib/platform/owner"
import { getPlatformCapacityReport } from "@/lib/platform/capacity-service"
import { CapacityMeter } from "@/components/platform/capacity-meter"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Users, Activity, CreditCard } from "lucide-react"
import { getTranslator } from "@/lib/i18n/server"
import { AuroraBackground } from "@/components/digit/aurora-background"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"
import { InView } from "@/components/motion-primitives/in-view"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Platform Capacity | DigiT",
  description: "Founder view of platform-wide capacity utilization.",
}

export default async function PlatformCapacityPage() {
  const { t } = await getTranslator()
  // Hidden from everyone except the configured platform owner. Returning 404
  // (not 403) avoids revealing the route exists to tenant users.
  const isOwner = await isCurrentUserPlatformOwner()
  if (!isOwner) {
    notFound()
  }

  const report = await getPlatformCapacityReport()
  const { platform, totals, limits, generatedAt } = report

  return (
    <div className="relative min-h-screen bg-background">
      <AuroraBackground />
      <main className="relative mx-auto max-w-6xl p-6 lg:p-10">
        <AnimatedGroup className="mb-8">
          <div className="flex items-center gap-2 text-sm text-primary mb-2">
            <Activity className="h-4 w-4" />
            <span className="font-medium">{t('platformCapacity.page.founderConsole')}</span>
          </div>
          <h1 className="text-3xl font-bold text-balance">{t('platformCapacity.page.title')}</h1>
          <p className="mt-2 text-muted-foreground text-pretty">
            {t('platformCapacity.page.subtitle')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('platformCapacity.page.updated', { date: new Date(generatedAt).toLocaleString() })}
          </p>
        </AnimatedGroup>

        {/* Platform-wide capacity */}
        <InView>
          <section aria-labelledby="platform-heading" className="mb-10">
            <h2 id="platform-heading" className="mb-4 text-lg font-semibold">
              {t('platformCapacity.page.platformWide')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <CapacityMeter metric={platform.tenants} />
              <CapacityMeter metric={platform.concurrentUsers} />
            </div>
          </section>
        </InView>

        {/* Snapshot totals */}
        <InView delay={0.08}>
          <section aria-labelledby="totals-heading" className="mb-10">
            <h2 id="totals-heading" className="mb-4 text-lg font-semibold">
              {t('platformCapacity.page.snapshot')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={Building2} label={t('platformCapacity.page.companies')} value={platform.tenants.used} />
              <StatCard icon={Users} label={t('platformCapacity.page.totalUsers')} value={totals.totalUsers} />
              <StatCard
                icon={Activity}
                label={t('platformCapacity.page.concurrentUsers')}
                value={platform.concurrentUsers.used}
              />
              <StatCard
                icon={CreditCard}
                label={t('platformCapacity.page.activeSubscriptions')}
                value={totals.totalActiveSubscriptions}
              />
            </div>
          </section>
        </InView>

        {/* Per-tenant configured limits */}
        <InView delay={0.16}>
          <section aria-labelledby="limits-heading">
            <h2 id="limits-heading" className="mb-4 text-lg font-semibold">
              {t('platformCapacity.page.perCompanyLimits')}
            </h2>
            <Card className="bg-card/80 backdrop-blur-xl border-border/50">
              <CardContent className="grid gap-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
                <LimitRow label={t('platformCapacity.page.usersPerCompany')} value={limits.maxUsersPerCompany.toLocaleString()} />
                <LimitRow
                  label={t('platformCapacity.page.aiRequestsPerMonth')}
                  value={limits.maxAiRequestsPerTenantMonthly.toLocaleString()}
                />
                <LimitRow
                  label={t('platformCapacity.page.workflowRunsPerMonth')}
                  value={limits.maxWorkflowExecutionsPerTenantMonthly.toLocaleString()}
                />
                <LimitRow
                  label={t('platformCapacity.page.documentStorage')}
                  value={`${(limits.maxDocumentStorageMbPerTenant / 1024).toFixed(0)} GB`}
                />
              </CardContent>
            </Card>
            <p className="mt-3 text-xs text-muted-foreground text-pretty">
              {t('platformCapacity.page.limitsNote')}
            </p>
          </section>
        </InView>
      </main>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
}) {
  return (
    <Card className="bg-card/80 backdrop-blur-xl border-border/50">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <span className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</span>
      </CardContent>
    </Card>
  )
}

function LimitRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  )
}
