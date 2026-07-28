"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  BarChart3,
  Users,
  Mail,
  Calendar,
  Download,
  Loader2,
  Zap
} from "lucide-react"
import { Logo } from "@/components/digit/logo"
import { AuroraBackground } from "@/components/digit/aurora-background"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { getPlanById, formatPrice, type SubscriptionPlan } from "@/lib/products"
import { getCheckoutSessionPlanId } from "@/app/actions/stripe"

interface SubscriptionData {
  plan_id: string
  status: string
  current_period_end: string | null
}

// Payment webhooks land asynchronously and can arrive after the browser has
// already redirected back here, so the very first read of `subscriptions`
// can miss a just-completed purchase (or, on an upgrade, still show the
// pre-upgrade row). Poll for a bit instead of trusting a single read -- and
// never fall back to fabricated plan/price info if the row still hasn't
// caught up by the time we give up.
const MAX_POLL_ATTEMPTS = 9
const POLL_INTERVAL_MS = 2000

type FetchState = "checking" | "ready" | "pending"

function CheckoutSuccessContent() {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const sessionId = searchParams?.get("session_id")
  // The legacy /checkout/[planId] flow redirects here with ?plan=; the live
  // embedded-checkout flow only passes ?session_id= (Stripe substitutes
  // {CHECKOUT_SESSION_ID}), so fall back to looking the plan up from the
  // session's own metadata.
  const expectedPlanFromUrl = searchParams?.get("plan")
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [fetchState, setFetchState] = useState<FetchState>("checking")

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    const readSubscription = async (organizationId: string) => {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan_id, status, current_period_end")
        .eq("organization_id", organizationId)
        .maybeSingle()
      return sub as SubscriptionData | null
    }

    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setFetchState("pending")
        return
      }
      if (!cancelled) setEmail(user.email || null)

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

      if (!profile?.organization_id) {
        if (!cancelled) setFetchState("pending")
        return
      }

      let expectedPlanId = expectedPlanFromUrl
      if (!expectedPlanId && sessionId) {
        expectedPlanId = await getCheckoutSessionPlanId(sessionId).catch(() => null)
      }

      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        if (cancelled) return

        const sub = await readSubscription(profile.organization_id)
        const isSettled = sub?.status === "active" || sub?.status === "trialing"
        const matchesExpectedPlan = !expectedPlanId || sub?.plan_id === expectedPlanId
        const resolvedPlan = sub ? getPlanById(sub.plan_id) : undefined

        if (sub && isSettled && matchesExpectedPlan && resolvedPlan) {
          if (!cancelled) {
            setSubscription(sub)
            setFetchState("ready")
          }
          return
        }

        if (attempt < MAX_POLL_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
        }
      }

      if (!cancelled) setFetchState("pending")
    }

    run()

    return () => {
      cancelled = true
    }
  }, [sessionId, expectedPlanFromUrl])

  const plan: SubscriptionPlan | undefined = subscription ? getPlanById(subscription.plan_id) : undefined

  const quickStartSteps = [
    {
      icon: BarChart3,
      title: t("checkout.success.exploreAnalytics"),
      description: t("checkout.success.exploreAnalyticsDesc"),
      href: "/analytics",
      action: t("checkout.success.openAnalytics")
    },
    {
      icon: Users,
      title: t("checkout.success.inviteTeam"),
      description: t("checkout.success.inviteTeamDesc"),
      href: "/settings?tab=team",
      action: t("checkout.success.manageTeam")
    },
    {
      icon: Zap,
      title: t("checkout.success.connectData"),
      description: t("checkout.success.connectDataDesc"),
      href: "/settings?tab=organization",
      action: t("checkout.success.setupIntegrations")
    }
  ]

  if (fetchState === "checking") {
    return <CheckoutSuccessFallback />
  }

  // Never fabricate plan/price info: if we gave up polling without a
  // subscription row that genuinely reflects the purchase (or somehow ended
  // up here without one), show an honest "still processing" state instead.
  if (fetchState === "pending" || !subscription || !plan) {
    return (
      <div className="relative min-h-screen bg-background">
        <AuroraBackground />
        <header className="relative border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Logo size="md" />
            </Link>
          </div>
        </header>

        <div className="relative container mx-auto px-6 py-24">
          <div className="max-w-lg mx-auto text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-6" />
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
              {t("checkout.success.stillProcessingTitle")}
            </h1>
            <p className="text-muted-foreground mb-8">
              {t("checkout.success.stillProcessingDesc")}
            </p>
            {email && (
              <p className="text-sm text-muted-foreground mb-8">
                {t("checkout.success.stillProcessingEmail", { email })}
              </p>
            )}
            <Button size="lg" className="gap-2" asChild>
              <Link href="/">
                {t("checkout.success.goToDashboard")}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-background">
      <AuroraBackground />
      {/* Header */}
      <header className="relative border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo size="md" />
          </Link>
        </div>
      </header>

      <div className="relative container mx-auto px-6 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Success Animation */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.6 }}
            className="flex justify-center mb-8"
          >
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-chart-2/20 flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-chart-2" />
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="absolute -top-2 -right-2"
              >
                <Sparkles className="w-8 h-8 text-primary" />
              </motion.div>
            </div>
          </motion.div>

          {/* Success Message */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-12"
          >
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t("checkout.success.welcome", { planName: plan.name })}
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              {t("checkout.success.activeDesc", { planName: plan.name })}
            </p>
          </motion.div>

          {/* Subscription Details Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-6 mb-8 border-chart-2/20 bg-chart-2/5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-semibold text-foreground">
                      {t("checkout.success.planTitle", { planName: plan.name })}
                    </h2>
                    <Badge className="bg-chart-2/20 text-chart-2 border-chart-2/30">
                      {t("checkout.success.active")}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    {email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <span>{email}</span>
                      </div>
                    )}
                    {subscription.current_period_end && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {t("checkout.success.nextBilling", { date: new Date(subscription.current_period_end).toLocaleDateString() })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">
                    {formatPrice(plan.priceInCents)}
                  </p>
                  <p className="text-sm text-muted-foreground">/month</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Plan Features Summary */}
          {plan && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="p-6 mb-8 border-border/50">
                <h3 className="text-lg font-semibold text-foreground mb-4">{t("checkout.success.yourPlanIncludes")}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/30">
                    <p className="text-2xl font-bold text-primary">
                      {plan.limits.users === -1 ? "∞" : plan.limits.users}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{t("checkout.success.teamMembers")}</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/30">
                    <p className="text-2xl font-bold text-primary">{plan.limits.modules}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("checkout.success.aiModules")}</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/30">
                    <p className="text-2xl font-bold text-primary">
                      {plan.limits.dataPoints === -1 ? "∞" : `${(plan.limits.dataPoints / 1000000).toFixed(0)}M`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{t("checkout.success.dataPoints")}</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/30">
                    <p className="text-2xl font-bold text-primary">
                      {plan.limits.apiCalls === -1 ? "∞" : `${(plan.limits.apiCalls / 1000).toFixed(0)}K`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{t("checkout.success.apiCalls")}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Quick Start Guide */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h3 className="text-lg font-semibold text-foreground mb-4">{t("checkout.success.quickStart")}</h3>
            <div className="grid gap-4 mb-8">
              {quickStartSteps.map((step, index) => (
                <Card 
                  key={index} 
                  className="p-4 border-border/50 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <step.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">{step.title}</h4>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={step.href}>
                        {step.action}
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </motion.div>

          {/* Main CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-center"
          >
            <Button size="lg" className="gap-2" asChild>
              <Link href="/">
                {t("checkout.success.goToDashboard")}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              {t("checkout.success.needHelp")}{" "}
              <a href="mailto:support@digit-enterprise.com" className="text-primary hover:underline">
                {t("checkout.success.contactSupport")}
              </a>
            </p>
          </motion.div>

          {/* Receipt Download */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-12 text-center"
          >
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Download className="w-4 h-4 mr-2" />
              {t("checkout.success.downloadReceipt")}
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function CheckoutSuccessFallback() {
  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center">
      <AuroraBackground />
      <Loader2 className="relative w-8 h-8 animate-spin text-primary" />
    </div>
  )
}

export default function CheckoutSuccessPage() {
  const { t } = useI18n()
  return (
    <Suspense fallback={<CheckoutSuccessFallback />}>
      <CheckoutSuccessContent />
    </Suspense>
  )
}
