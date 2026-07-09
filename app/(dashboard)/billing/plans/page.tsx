"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MetricCard, MetricGrid } from "@/components/digit/metric-card"
import { toast } from "sonner"
import { Check, Gift, Percent, Ticket, Sparkles, AlertTriangle, BarChart3, Timer } from "lucide-react"
import { useI18n } from "@/components/providers/i18n-provider"

interface OrgTrial {
  orgId: string
  planId: string
  startedAt: string
  expiresAt: string
  status: 'active' | 'expired' | 'converted' | 'cancelled'
  daysRemaining: number
}

interface FoundingPlan {
  id: string
  name: string
  discountPercent: number
  validUntil: string
  maxSeats: number
  features: string[]
}

interface TrialAnalytics {
  activeTrials: number
  expiringSoon: number
  conversionRate: number
}

interface PlanDef {
  key: string
  price: number
  features: string[]
}

function formatPrice(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function BillingPlansPage() {
  const { t } = useI18n()

  const REGULAR_PLANS: PlanDef[] = [
    {
      key: 'starter',
      price: 2999,
      features: [
        'billingPlans.page.features.basicAnalytics',
        'billingPlans.page.features.documents10',
        'billingPlans.page.features.emailSupport',
      ],
    },
    {
      key: 'professional',
      price: 9999,
      features: [
        'billingPlans.page.features.advancedAnalytics',
        'billingPlans.page.features.unlimitedDocuments',
        'billingPlans.page.features.aiInsights',
        'billingPlans.page.features.prioritySupport',
        'billingPlans.page.features.apiAccess',
      ],
    },
    {
      key: 'enterprise',
      price: 29999,
      features: [
        'billingPlans.page.features.everythingInPro',
        'billingPlans.page.features.customIntegrations',
        'billingPlans.page.features.dedicatedManager',
        'billingPlans.page.features.slaGuarantee',
        'billingPlans.page.features.advancedSecurity',
        'billingPlans.page.features.onPremise',
      ],
    },
  ]

  const PRO_TRIAL_FEATURES = [
    'billingPlans.page.features.unlimitedDocuments',
    'billingPlans.page.features.aiAnalysis',
    'billingPlans.page.features.realTimeMonitoring',
  ]

  const ENTERPRISE_TRIAL_FEATURES = [
    'billingPlans.page.features.everythingInPro',
    'billingPlans.page.features.customIntegrations',
    'billingPlans.page.features.dedicatedManager',
  ]

  const [trial, setTrial] = useState<OrgTrial | null>(null)
  const [foundingPlans, setFoundingPlans] = useState<FoundingPlan[]>([])
  const [analytics, setAnalytics] = useState<TrialAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [discountCode, setDiscountCode] = useState('')
  const [discountValid, setDiscountValid] = useState<boolean | null>(null)
  const [discountValue, setDiscountValue] = useState<number | null>(null)
  const [discountReason, setDiscountReason] = useState('')
  const [applyingDiscount, setApplyingDiscount] = useState(false)
  const [startingTrial, setStartingTrial] = useState(false)

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const [trialRes, discountRes] = await Promise.all([
          fetch('/api/v1/billing/trials'),
          fetch('/api/v1/billing/discounts'),
        ]);

        if (cancelled) return;

        if (!trialRes.ok || !discountRes.ok) {
          const errorData1 = await trialRes.json();
          const errorData2 = await discountRes.json();
          throw new Error(
            errorData1.error || errorData2.error || t('billingPlans.page.errors.loadFailed')
          );
        }

        const trialData = await trialRes.json();
        const discountData = await discountRes.json();

        if (!cancelled) {
          setTrial(trialData.trial);
          setFoundingPlans(discountData.foundingPlans || []);
          setAnalytics(discountData.analytics || null);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : t('billingPlans.page.errors.loadFailed'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [t]);

  async function handleStartTrial(planId: string) {
    setStartingTrial(true);
    try {
      const res = await fetch('/api/v1/billing/trials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || t('billingPlans.page.errors.startTrialFailed'));
      }

      const data = await res.json();
      setTrial(data.trial);
      toast.success(t('billingPlans.page.success.trialStarted'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('billingPlans.page.errors.startTrialFailed'));
    } finally {
      setStartingTrial(false);
    }
  }

  async function handleApplyDiscount() {
    if (!discountCode.trim()) {
      toast.error(t('billingPlans.page.errors.enterDiscountCode'));
      return;
    }

    setApplyingDiscount(true);
    setDiscountValid(null);
    setDiscountValue(null);
    setDiscountReason('');

    try {
      const res = await fetch('/api/v1/billing/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: discountCode.trim(), plan: trial?.planId || '' }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || t('billingPlans.page.errors.applyDiscountFailed'));
      }

      const data = await res.json();
      if (data.valid) {
        setDiscountValid(true);
        setDiscountValue(data.discount);
        toast.success(t('billingPlans.page.success.discountApplied', { discount: data.discount }));
      } else {
        setDiscountValid(false);
        setDiscountReason(data.reason || t('billingPlans.page.errors.applyDiscountFailed'));
        toast.error(data.reason || t('billingPlans.page.errors.applyDiscountFailed'));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('billingPlans.page.errors.applyDiscountFailed');
      setDiscountValid(false);
      setDiscountReason(errorMessage);
      toast.error(errorMessage);
    } finally {
      setApplyingDiscount(false);
    }
  }

  const discountAmount = (price: number): number => {
    if (discountValid && discountValue) {
      return Math.round(price * (1 - discountValue / 100))
    }
    return price
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Sparkles className="h-6 w-6 animate-pulse text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('billingPlans.page.title')}</h1>
        <p className="text-muted-foreground">{t('billingPlans.page.subtitle')}</p>
      </div>

      {trial && trial.status === 'active' && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Timer className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle className="text-lg">{t('billingPlans.page.freeTrialActive')}</CardTitle>
                  <CardDescription>
                    {trial.daysRemaining > 0
                      ? trial.daysRemaining === 1
                        ? t('billingPlans.page.dayRemaining')
                        : t('billingPlans.page.daysRemaining', { count: trial.daysRemaining })
                      : t('billingPlans.page.expiringToday')}
                  </CardDescription>
                </div>
              </div>
              <Button>
                <Sparkles className="mr-2 h-4 w-4" />
                {t('billingPlans.page.upgradeNow')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-emerald-500" />
              {t('billingPlans.page.startedExpires', { started: formatDate(trial.startedAt), expires: formatDate(trial.expiresAt) })}
            </div>
          </CardContent>
        </Card>
      )}

      {foundingPlans.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {foundingPlans.map((plan) => {
            const expired = new Date(plan.validUntil) < new Date()
            return (
              <Card key={plan.id} className={expired ? 'opacity-50' : 'border-primary/30'}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                        {!expired && (
                          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30">
                            <Percent className="mr-1 h-3 w-3" />
                            {plan.discountPercent}% OFF
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        <div className="flex items-center gap-1 mt-1">
                          <Gift className="h-3 w-3" />
                          {expired ? t('billingPlans.page.expired') : t('billingPlans.page.validUntil', { date: formatDate(plan.validUntil) })}
                        </div>
                      </CardDescription>
                    </div>
                    {!expired && (
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">{plan.discountPercent}%</div>
                        <div className="text-xs text-muted-foreground">{t('billingPlans.page.discount')}</div>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {!expired && (
                    <Button className="w-full" onClick={() => toast.success(t('billingPlans.page.claimInitiated'))}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      {t('billingPlans.page.claimFoundingPlan')}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            {t('billingPlans.page.discountCode')}
          </CardTitle>
          <CardDescription>{t('billingPlans.page.discountCodeDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Input
                placeholder={t('billingPlans.page.discountPlaceholder')}
                value={discountCode}
                onChange={(e) => { setDiscountCode(e.target.value); setDiscountValid(null); setDiscountValue(null); setDiscountReason('') }}
                className={discountValid === true ? 'border-emerald-500' : discountValid === false ? 'border-red-500' : ''}
              />
              {discountValid === true && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Check className="h-4 w-4 text-emerald-500" />
                </div>
              )}
            </div>
            <Button onClick={handleApplyDiscount} disabled={applyingDiscount || !discountCode.trim()}>
              {applyingDiscount ? t('billingPlans.page.applying') : t('billingPlans.page.apply')}
            </Button>
          </div>
          {discountValid === false && discountReason && (
            <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {discountReason}
            </p>
          )}
          {discountValid === true && discountValue && (
            <p className="mt-2 text-sm text-emerald-500 flex items-center gap-1">
              <Check className="h-3 w-3" />
              {t('billingPlans.page.discountAppliedEligible', { discount: discountValue })}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('billingPlans.page.pricingComparison')}</CardTitle>
          <CardDescription>{t('billingPlans.page.pricingComparisonDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('billingPlans.page.plan')}</TableHead>
                <TableHead>{t('billingPlans.page.regularPrice')}</TableHead>
                <TableHead>{t('billingPlans.page.foundingPrice')}</TableHead>
                <TableHead>{t('billingPlans.page.yourPrice')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {REGULAR_PLANS.map((plan) => {
                const foundingPlan = foundingPlans.find(fp =>
                  t(`billingPlans.page.plans.${plan.key}`).toLowerCase().includes(fp.name.toLowerCase()) ||
                  fp.name.toLowerCase().includes(t(`billingPlans.page.plans.${plan.key}`).toLowerCase())
                )
                const foundingPrice = foundingPlan
                  ? Math.round(plan.price * (1 - foundingPlan.discountPercent / 100))
                  : plan.price
                const discountedPrice = discountAmount(plan.price)
                const effectivePrice = discountValid ? discountedPrice : plan.price
                return (
                  <TableRow key={plan.key}>
                    <TableCell className="font-medium">{t(`billingPlans.page.plans.${plan.key}`)}</TableCell>
                    <TableCell>{formatPrice(plan.price)}<span className="text-xs text-muted-foreground">{t('billingPlans.page.perMonth')}</span></TableCell>
                    <TableCell>
                      {foundingPlan ? (
                        <span className="text-emerald-500 font-medium">
                          {formatPrice(foundingPrice)}
                          <span className="text-xs text-muted-foreground">{t('billingPlans.page.perMonth')}</span>
                          <Badge variant="outline" className="ml-2 text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/30">
                            -{foundingPlan.discountPercent}%
                          </Badge>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{t('billingPlans.page.na')}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {effectivePrice !== plan.price ? (
                        <span className="text-primary font-bold">
                          {formatPrice(effectivePrice)}
                          <span className="text-xs text-muted-foreground">{t('billingPlans.page.perMonth')}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{t('billingPlans.page.na')}</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!trial && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              {t('billingPlans.page.startFreeTrial')}
            </CardTitle>
            <CardDescription>{t('billingPlans.page.tryAnyPlan')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base">{t('billingPlans.page.proTrial')}</CardTitle>
                <CardDescription>{t('billingPlans.page.proTrialDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm mb-4">
                  {PRO_TRIAL_FEATURES.map((key) => (
                    <li key={key} className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-500" /> {t(key)}</li>
                  ))}
                </ul>
                <Button className="w-full" onClick={() => handleStartTrial('pro-trial')} disabled={startingTrial}>
                  {startingTrial ? t('billingPlans.page.starting') : t('billingPlans.page.startProTrial')}
                </Button>
              </CardContent>
            </Card>
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base">{t('billingPlans.page.enterpriseTrial')}</CardTitle>
                <CardDescription>{t('billingPlans.page.enterpriseTrialDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm mb-4">
                  {ENTERPRISE_TRIAL_FEATURES.map((key) => (
                    <li key={key} className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-500" /> {t(key)}</li>
                  ))}
                </ul>
                <Button className="w-full" onClick={() => handleStartTrial('enterprise-trial')} disabled={startingTrial}>
                  {startingTrial ? t('billingPlans.page.starting') : t('billingPlans.page.startEnterpriseTrial')}
                </Button>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      )}

      {analytics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4" />
              {t('billingPlans.page.trialAnalytics')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MetricGrid columns={3}>
              <MetricCard label={t('billingPlans.page.metrics.activeTrials')} value={analytics.activeTrials} trend="up" change={12} />
              <MetricCard label={t('billingPlans.page.metrics.expiringSoon')} value={analytics.expiringSoon} trend={analytics.expiringSoon > 3 ? 'down' : 'stable'} />
              <MetricCard label={t('billingPlans.page.metrics.conversionRate')} value={`${analytics.conversionRate}%`} trend={analytics.conversionRate > 50 ? 'up' : 'down'} change={5} />
            </MetricGrid>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
