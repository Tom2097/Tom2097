import { redirect } from 'next/navigation'
import { Shield, Users, BarChart3, Eye, EyeOff, Info, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { extractTenantContext } from '@/lib/multitenant/context.server'
import { getPeerComparison, DEFAULT_BENCHMARK_CONFIG } from '@/lib/analytics/cohort-benchmarking'
import { ConfidenceIndicator } from '@/components/digit/confidence-indicator'
import { getTranslator } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

const METRIC_LABELS: Record<string, string> = {
  compliance_score: 'Compliance Score',
  resource_utilization: 'Resource Utilization',
  ai_actions: 'AI Actions',
  document_count: 'Document Count',
}

const METRIC_ICONS: Record<string, typeof BarChart3> = {
  compliance_score: Shield,
  resource_utilization: BarChart3,
  ai_actions: BarChart3,
  document_count: BarChart3,
}

function getPercentileRank(value: number, p25: number, p50: number, p75: number): { rank: string; color: string; label: string } {
  if (value >= p75) return { rank: 'above75th', color: 'text-emerald-500', label: 'above75th' }
  if (value >= p50) return { rank: 'aboveMedian', color: 'text-blue-500', label: 'aboveMedian' }
  if (value >= p25) return { rank: 'belowMedian', color: 'text-amber-500', label: 'belowMedian' }
  return { rank: 'below25th', color: 'text-red-500', label: 'below25th' }
}

function formatMetricValue(metric: string, value: number): string {
  if (metric === 'compliance_score') return `${value}%`
  if (metric === 'ai_actions') return value.toLocaleString()
  return value.toFixed(1)
}

export default async function BenchmarksPage() {
  const ctx = await extractTenantContext()
  const { t } = await getTranslator()
  if (!ctx) redirect('/auth/login')

  const orgId = ctx.organizationId
  const comparisons = await getPeerComparison(orgId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-500">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("benchmarks.page.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("benchmarks.page.subtitle")}
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="gap-1.5 text-xs">
          <Shield className="h-3 w-3" />
          k={DEFAULT_BENCHMARK_CONFIG.kAnonymityThreshold}+ DP (&epsilon;={DEFAULT_BENCHMARK_CONFIG.epsilon})
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-indigo-500/20 bg-indigo-500/5">
          <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-muted-foreground">{t("benchmarks.page.sampleSize")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{comparisons.length > 0 ? comparisons[0].sampleSize : 'N/A'}</p>
             <p className="text-xs text-muted-foreground mt-1">{t("benchmarks.page.organizationsInPeerGroup")}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-muted-foreground">{t("benchmarks.page.privacyStatus")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {comparisons.some(r => r.anonymized) ? (
                <>
                  <EyeOff className="h-5 w-5 text-amber-500" />
                   <p className="text-lg font-semibold text-foreground">{t("benchmarks.page.noiseAdded")}</p>
                 </>
               ) : (
                 <>
                   <Eye className="h-5 w-5 text-emerald-500" />
                   <p className="text-lg font-semibold text-foreground">{t("benchmarks.page.clear")}</p>
                 </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
               {comparisons.some(r => r.anonymized)
                 ? t("benchmarks.page.laplaceNoiseApplied")
                 : t("benchmarks.page.cohortSizeMeetsThreshold")}
            </p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-blue-500/5 sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-muted-foreground">{t("benchmarks.page.dimensions")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_BENCHMARK_CONFIG.dimensions.map(dim => (
                <Badge key={dim} variant="outline" className="text-xs capitalize">
                  {dim}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          Peer Comparison by Metric
        </h2>
        {comparisons.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-sm text-muted-foreground">No benchmark data available for your cohort.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {comparisons.map((result) => {
              const Icon = METRIC_ICONS[result.metric] || BarChart3
              const label = METRIC_LABELS[result.metric] || result.metric
              const percentile = getPercentileRank(result.value, result.percentile25, result.percentile50, result.percentile75)

              return (
                <Card key={result.metric}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                         <CardTitle className="text-base">{t(`benchmarks.page.${result.metric}`)}</CardTitle>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {result.anonymized ? (
                          <Badge variant="outline" className="text-xs gap-1 border-amber-500/30 text-amber-600">
                            <EyeOff className="h-3 w-3" /> DP
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs gap-1 border-emerald-500/30 text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" /> k-Anon
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          n={result.sampleSize}
                        </Badge>
                      </div>
                    </div>
                       <CardDescription>
                         {result.cohort} {t("benchmarks.page.cohort")} — {t(`benchmarks.page.${result.metric}`)}
                       </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-3xl font-bold text-foreground">
                        {formatMetricValue(result.metric, result.value)}
                      </span>
                       <span className={`text-sm font-medium ${percentile.color}`}>
                         {t(`benchmarks.page.${percentile.label}`)}
                       </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                       <span>{t("benchmarks.page.p25")}: {formatMetricValue(result.metric, result.percentile25)}</span>
                       <span>{t("benchmarks.page.p50")}: {formatMetricValue(result.metric, result.percentile50)}</span>
                       <span>{t("benchmarks.page.p75")}: {formatMetricValue(result.metric, result.percentile75)}</span>
                      </div>
                      <div className="relative h-2 rounded-full bg-secondary">
                        <div
                          className="absolute top-0 left-0 h-full rounded-full bg-muted-foreground/30"
                          style={{
                            left: `${(result.percentile25 / (result.percentile75 * 1.5)) * 100}%`,
                            width: `${((result.percentile75 - result.percentile25) / (result.percentile75 * 1.5)) * 100}%`,
                          }}
                        />
                        <div
                          className="absolute top-0 h-full w-1.5 rounded-full bg-primary -translate-x-1/2 transition-all"
                          style={{
                            left: `${(result.value / (result.percentile75 * 1.5)) * 100}%`,
                          }}
                        />
                      </div>
                       <div className="flex justify-between text-xs text-muted-foreground">
                         <span>{t("benchmarks.page.low")}</span>
                         <span>{t("benchmarks.page.high")}</span>
                       </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Info className="h-3 w-3" />
                       <span>
                         {result.anonymized
                           ? t("benchmarks.page.valueObfuscated", { epsilon: DEFAULT_BENCHMARK_CONFIG.epsilon })
                           : t("benchmarks.page.clearValue", { sampleSize: result.sampleSize, k: DEFAULT_BENCHMARK_CONFIG.kAnonymityThreshold })
                         }
                       </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
