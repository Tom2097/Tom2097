import { redirect } from 'next/navigation'
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, BarChart3, Crosshair, GitBranch, Network, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { extractTenantContext } from '@/lib/multitenant/context.server'
import { analyzeDriverDecomposition, getCrossWorkspaceImpact } from '@/lib/analytics/driver-decomposition'
import { ConfidenceIndicator } from '@/components/digit/confidence-indicator'
import { getTranslator } from '@/lib/i18n/server'
import { AnimatedGroup } from '@/components/motion-primitives/animated-group'
import { InView } from '@/components/motion-primitives/in-view'

export const dynamic = 'force-dynamic'

const WORKSPACE_COLORS: Record<string, string> = {
  compliance: 'bg-indigo-500',
  resources: 'amber',
  performance: 'emerald',
  operations: 'blue',
}

const WORKSPACE_BG: Record<string, string> = {
  compliance: 'bg-indigo-500/10 text-indigo-600',
  resources: 'bg-amber-500/10 text-amber-600',
  performance: 'bg-emerald-500/10 text-emerald-600',
  operations: 'bg-blue-500/10 text-blue-600',
}

const WORKSPACE_HEX: Record<string, string> = {
  compliance: '#6366f1',
  resources: '#f59e0b',
  performance: '#10b981',
  operations: '#3b82f6',
}

function ImpactBadge({ impact }: { impact: number }) {
  const isPositive = impact > 0
  const isNegative = impact < 0
  const color = isPositive ? 'text-emerald-600 bg-emerald-500/10' : isNegative ? 'text-red-600 bg-red-500/10' : 'text-muted-foreground bg-secondary'

  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {isPositive ? <ArrowUp className="h-3 w-3" /> : isNegative ? <ArrowDown className="h-3 w-3" /> : null}
      {impact > 0 ? '+' : ''}{impact}
    </span>
  )
}

export default async function DriverAnalysisPage() {
  const { t } = await getTranslator()
  const ctx = await extractTenantContext()
  if (!ctx) redirect('/auth/login')

  const orgId = ctx.organizationId

  const [decomposition, impacts] = await Promise.all([
    analyzeDriverDecomposition(orgId).catch(() => null),
    getCrossWorkspaceImpact(orgId).catch(() => []),
  ])

  return (
    <div className="space-y-6">
      <AnimatedGroup>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-500">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('driverAnalysis.page.title')}</h1>
              <p className="text-sm text-muted-foreground">
                {t('driverAnalysis.page.subtitle')}
              </p>
            </div>
          </div>
          {decomposition && (
            <Badge variant="secondary" className="gap-1.5 text-xs capitalize">
              <TrendingUp className="h-3 w-3" />
              {decomposition.metric.replace(/_/g, ' ')}
            </Badge>
          )}
        </div>
      </AnimatedGroup>

      {!decomposition ? (
        <InView>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-sm text-muted-foreground">{t('driverAnalysis.page.insufficientData')}</p>
          </CardContent>
        </Card>
        </InView>
      ) : (
        <>
          <InView>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('driverAnalysis.page.baseline')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">{decomposition.baseline}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('driverAnalysis.page.periodStart')}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('driverAnalysis.page.current')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">{decomposition.current}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('driverAnalysis.page.currentScore')}</p>
              </CardContent>
            </Card>
            <Card className={`border-border/50 ${decomposition.change >= 0 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('driverAnalysis.page.totalChange')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {decomposition.change >= 0
                    ? <TrendingUp className="h-5 w-5 text-emerald-500" />
                    : <TrendingUp className="h-5 w-5 text-red-500 rotate-180" />
                  }
                  <p className={`text-3xl font-bold ${decomposition.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {decomposition.change >= 0 ? '+' : ''}{decomposition.change}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('driverAnalysis.page.confidence')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ConfidenceIndicator confidence={decomposition.confidence} showLabel />
                <p className="text-xs text-muted-foreground mt-2">{t('driverAnalysis.page.basedOnData')}</p>
              </CardContent>
            </Card>
          </div>
          </InView>

          <InView delay={0.08}>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10">
                    <Crosshair className="h-4 w-4 text-rose-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{t('driverAnalysis.page.driverContributions')}</CardTitle>
                    <CardDescription>{t('driverAnalysis.page.driverContributionsDesc')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {decomposition.drivers.map((driver) => {
                  const absContribution = Math.abs(driver.contribution)
                  const isPositive = driver.direction === 'positive'
                  const barColor = isPositive ? 'bg-emerald-500' : 'bg-red-500'

                  return (
                    <div key={driver.name} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium capitalize ${WORKSPACE_BG[driver.workspace]}`}>
                            {driver.workspace}
                          </span>
                          <span className="text-sm font-medium text-foreground">{driver.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            r={driver.correlationScore.toFixed(2)}
                          </span>
                          <span className={`text-sm font-semibold ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                            {isPositive ? '+' : ''}{driver.contribution.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="relative h-2.5 rounded-full bg-secondary">
                        <div
                          className={`h-full rounded-full ${barColor} transition-all`}
                          style={{
                            width: `${Math.min(absContribution, 100)}%`,
                            marginLeft: driver.contribution < 0 ? 'auto' : undefined,
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{driver.details}</p>
                    </div>
                  )
                })}

                {decomposition.drivers.length === 0 && (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    {t('driverAnalysis.page.noDriverData')}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                    <Network className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{t('driverAnalysis.page.crossWorkspaceImpact')}</CardTitle>
                    <CardDescription>{t('driverAnalysis.page.crossWorkspaceImpactDesc')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {impacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
                    <Network className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p>{t('driverAnalysis.page.noCrossWorkspace')}</p>
                    <p className="text-xs mt-1">{t('driverAnalysis.page.impactSignals')}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {impacts.map((impact, i) => (
                      <div key={i} className="rounded-xl border border-border/50 bg-secondary/20 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs font-medium">
                              {impact.source}
                            </Badge>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                            <Badge variant="secondary" className="text-xs font-medium">
                              {impact.target}
                            </Badge>
                          </div>
                          <ImpactBadge impact={impact.impact} />
                        </div>
                        <p className="text-sm text-muted-foreground">{impact.description}</p>
                        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <AlertTriangle className="h-3 w-3" />
                          <span>{t('driverAnalysis.page.impactScoreReflects')}</span>
                        </div>
                      </div>
                    ))}

                    <div className="rounded-xl border border-border/50 bg-secondary/10 p-3">
                      <h4 className="text-xs font-medium text-muted-foreground mb-2">{t('driverAnalysis.page.impactMatrix')}</h4>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="text-muted-foreground font-medium">{t('driverAnalysis.page.sourceTarget')}</div>
                        <div className="text-muted-foreground font-medium">{t('driverAnalysis.page.resources')}</div>
                        <div className="text-muted-foreground font-medium">{t('driverAnalysis.page.performance')}</div>
                        {['Compliance', 'Resources', 'CRM'].map(source => (
                          <>
                            <div key={source} className="font-medium text-foreground text-left">{source}</div>
                            {['Resources', 'Performance'].map(target => {
                              const match = impacts.find(i => i.source === source && i.target === target)
                              return (
                                <div key={`${source}-${target}`}>
                                  {match ? (
                                    <ImpactBadge impact={match.impact} />
                                  ) : (
                                    <span className="text-muted-foreground/40">&mdash;</span>
                                  )}
                                </div>
                              )
                            })}
                          </>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          </InView>
        </>
      )}
    </div>
  )
}
