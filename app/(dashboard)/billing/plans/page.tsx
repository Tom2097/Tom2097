"use client"

// Billing & Plans. Rebuilt around the real single-product catalog in
// lib/products.ts. The previous version still rendered the abandoned
// models (founding Pro/Enterprise discounts, Starter/Professional/Enterprise
// rupee tiers, and "Pro"/"Enterprise" trials that wrote legacy plan ids
// onto subscriptions), and several of its buttons were inert ("Claim
// Founding Plan" only showed a success toast; "Upgrade Now" had no handler).

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Check, Ticket, Sparkles, AlertTriangle, Timer } from "lucide-react"
import { useI18n } from "@/components/providers/i18n-provider"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"
import { SUBSCRIPTION_PLANS, ANNUAL_PRICE_CENTS, MONTHLY_PRICE_CENTS, formatPrice } from "@/lib/products"

interface OrgTrial {
  orgId: string
  planId: string
  startedAt: string
  expiresAt: string
  status: 'active' | 'expired' | 'converted' | 'cancelled'
  daysRemaining: number
}

const PLAN = SUBSCRIPTION_PLANS[0]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function BillingPlansPage() {
  const { t } = useI18n()

  const [trial, setTrial] = useState<OrgTrial | null>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [discountCode, setDiscountCode] = useState('')
  const [discountValid, setDiscountValid] = useState<boolean | null>(null)
  const [discountValue, setDiscountValue] = useState<number | null>(null)
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [discountReason, setDiscountReason] = useState('')
  const [applyingDiscount, setApplyingDiscount] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/v1/billing/trials')
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || t('billingPlans.page.errors.loadFailed'))
        }
        const data = await res.json()
        if (!cancelled) {
          setTrial(data.trial)
          setSubscriptionStatus(data.subscriptionStatus ?? null)
        }
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : t('billingPlans.page.errors.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [t])

  async function handleApplyDiscount() {
    if (!discountCode.trim()) {
      toast.error(t('billingPlans.page.errors.enterDiscountCode'))
      return
    }

    setApplyingDiscount(true)
    setDiscountValid(null)
    setDiscountValue(null)
    setDiscountReason('')

    try {
      const res = await fetch('/api/v1/billing/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: discountCode.trim(), plan: PLAN.id }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data.valid) {
        setDiscountValid(true)
        setDiscountValue(data.discount)
        setDiscountType(data.discountType === 'fixed' ? 'fixed' : 'percentage')
        toast.success(t('billingPlans.page.codeValid'))
        return
      }

      // The API answers an invalid/expired code with 400 + { valid: false,
      // reason }. The old handler only read `error`, so every rejected code
      // surfaced as the generic "Failed to validate discount code".
      const reason = data.reason || data.error || t('billingPlans.page.errors.applyDiscountFailed')
      setDiscountValid(false)
      setDiscountReason(reason)
      toast.error(reason)
    } catch {
      const reason = t('billingPlans.page.errors.applyDiscountFailed')
      setDiscountValid(false)
      setDiscountReason(reason)
      toast.error(reason)
    } finally {
      setApplyingDiscount(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Sparkles className="h-6 w-6 animate-pulse text-muted-foreground" />
      </div>
    )
  }

  const hasSubscription = trial
    ? trial.status !== 'expired' && trial.status !== 'cancelled'
    : ['trialing', 'active', 'past_due'].includes(subscriptionStatus ?? '')

  return (
    <div className="space-y-6">
      <AnimatedGroup>
        <h1 className="text-2xl font-bold">{t('billingPlans.page.title')}</h1>
        <p className="text-muted-foreground">{t('billingPlans.page.subtitle')}</p>
      </AnimatedGroup>

      {trial && trial.status === 'active' && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
              <Button asChild>
                <Link href="/settings/billing">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('billingPlans.page.manageSubscription')}
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-emerald-500" />
              {trial.startedAt
                ? t('billingPlans.page.startedExpires', { started: formatDate(trial.startedAt), expires: formatDate(trial.expiresAt) })
                : t('billingPlans.page.expires', { date: formatDate(trial.expiresAt) })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className={hasSubscription ? 'border-primary/30' : undefined}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{PLAN.name}</CardTitle>
                {hasSubscription && <Badge>{t('settings.subscription.current')}</Badge>}
              </div>
              <CardDescription className="mt-1">{PLAN.description}</CardDescription>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-bold">
                {formatPrice(ANNUAL_PRICE_CENTS)}
                <span className="text-sm font-normal text-muted-foreground">{t('billingPlans.page.perYear')}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {t('billingPlans.page.orMonthly', { price: formatPrice(MONTHLY_PRICE_CENTS) })}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="grid gap-2 sm:grid-cols-2">
            {PLAN.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{t('billingPlans.page.trialNote')}</p>
          {hasSubscription ? (
            <Button variant="outline" className="w-full" asChild>
              <Link href="/settings/billing">{t('billingPlans.page.manageSubscription')}</Link>
            </Button>
          ) : (
            <Button className="w-full" asChild>
              <Link href="/checkout">
                <Sparkles className="mr-2 h-4 w-4" />
                {t('billingPlans.page.startFreeTrial')}
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

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
                onKeyDown={(e) => { if (e.key === 'Enter') handleApplyDiscount() }}
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
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-emerald-500 flex items-center gap-1">
                <Check className="h-3 w-3" />
                {t('billingPlans.page.discountValidNote', {
                  discount: discountType === 'percentage' ? `${discountValue}%` : formatPrice(discountValue * 100),
                })}
              </p>
              {/* Codes are applied (and their price locked) at checkout. */}
              <Button size="sm" asChild>
                <Link href={`/checkout?code=${encodeURIComponent(discountCode.trim().toUpperCase())}`}>
                  {t('billingPlans.page.useAtCheckout')}
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
