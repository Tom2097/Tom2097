"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { CreditCard, Clock, AlertCircle, Loader2, Shield, Gift, XCircle } from "lucide-react"
import { Logo } from "@/components/digit/logo"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { getPlanById, formatPrice } from "@/lib/products"
import { createBillingPortalSession } from "@/app/actions/stripe"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface SubscriptionData {
  plan_id: string
  status: string
  current_period_end: string | null
  trial_ends_at: string | null
  cancel_at_period_end: boolean | null
  billing_mode: "one_time" | "split" | null
  is_founding: boolean | null
  locked_price_cents: number | null
}

export default function BillingSettingsPage() {
  const { t } = useI18n()
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          router.push('/auth/login')
          return
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", user.id)
          .single()

        if (!profile?.organization_id) {
          throw new Error(t("settings.billing.noOrganization"))
        }

        const { data: sub } = await supabase
          .from("subscriptions")
          .select("plan_id, status, current_period_end, trial_ends_at, cancel_at_period_end, billing_mode, is_founding, locked_price_cents")
          .eq("organization_id", profile.organization_id)
          .single()

        if (sub) {
          setSubscription(sub)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t("settings.billing.failedToLoad"))
      } finally {
        setLoading(false)
      }
    }

    fetchSubscription()
  }, [router])

  const handleManageBilling = async () => {
    try {
      const { url } = await createBillingPortalSession()
      if (url) {
        window.location.href = url
      }
    } catch (err) {
      setError(t("settings.billing.failedPortal"))
    }
  }

  const handleCancelSubscription = async () => {
    try {
      setIsCancelling(true)
      setCancelError(null)

      const response = await fetch('/api/v1/billing/subscription/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to cancel subscription')
      }

      setSubscription((prev) => (prev ? { ...prev, cancel_at_period_end: true } : prev))
      setCancelDialogOpen(false)
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel subscription')
    } finally {
      setIsCancelling(false)
    }
  }

  const plan = subscription ? getPlanById(subscription.plan_id) : null
  const isTrial = subscription?.status === "trialing"
  const isSplit = subscription?.billing_mode === "split"

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-bold mb-2">{t("settings.billing.errorTitle")}</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => window.location.reload()}>{t("settings.billing.retry")}</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo size="md" />
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="outline" asChild>
              <Link href="/settings">Settings</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{t("settings.billing.title")}</h1>
            <p className="text-muted-foreground">{t("settings.billing.subtitle")}</p>
          </motion.div>

          {/* Subscription Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Card className="p-6 mb-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-semibold text-foreground">
                      {plan?.name || t("settings.billing.plan")} Subscription
                    </h2>
                    <Badge className="bg-primary/10 text-primary">
                      {subscription?.status}
                    </Badge>
                    {subscription?.cancel_at_period_end && (
                      <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">
                        Cancels at period end
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    {subscription?.current_period_end && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>
                          Next billing: {new Date(subscription.current_period_end).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {isTrial && subscription?.trial_ends_at && (
                      <div className="flex items-center gap-2">
                        <Gift className="w-4 h-4 text-emerald-500" />
                        <span>
                          Trial ends: {new Date(subscription.trial_ends_at).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">
                    {subscription?.locked_price_cents ? formatPrice(subscription.locked_price_cents) : plan ? formatPrice(plan.priceInCents) : "-"}
                  </p>
                  <p className="text-sm text-muted-foreground">/year</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Billing Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="p-6 mb-8">
              <h3 className="text-lg font-semibold text-foreground mb-6">{t("settings.billing.billingActions")}</h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button onClick={handleManageBilling} className="gap-2">
                  <CreditCard className="w-4 h-4" />
                  Manage Billing
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/pricing" className="gap-2">
                    <CreditCard className="w-4 h-4" />
                    Change Plan
                  </Link>
                </Button>
              </div>
            </Card>
          </motion.div>

          {/* Refund policy (Pricing & Payments Build Spec v1.0, section 5:
              no refunds on cancellation or sign-off -- access continues to
              the end of the paid term). Replaces the old 30-day
              monthly-refund-window UI, which no longer reflects this
              product's policy. */}
          {!isTrial && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Card className="p-6 mb-8">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">No refunds</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Cancelling doesn&apos;t refund any amount already charged -- access continues until the end of your paid term. Your data can be exported in full at any time, including after you leave.
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Cancel Subscription */}
          {subscription && subscription.status !== "canceled" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
            >
              <Card className="p-6 mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">Cancel Subscription</h3>

                {subscription.cancel_at_period_end ? (
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Cancellation scheduled</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Your subscription will remain active until{" "}
                          {subscription.current_period_end
                            ? new Date(subscription.current_period_end).toLocaleDateString()
                            : "the end of your current billing period"}
                          , after which it will not renew.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Cancelling stops future renewal. You&apos;ll keep access until the end of your current 12-month term
                      {isSplit ? " -- any remaining instalments for this term are still due" : ""}. No amount already paid is refunded.
                    </p>
                    {cancelError && (
                      <p className="text-sm text-destructive">{cancelError}</p>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => setCancelDialogOpen(true)}
                      className="gap-2 text-destructive hover:text-destructive"
                    >
                      <XCircle className="w-4 h-4" />
                      Cancel Subscription
                    </Button>
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          <AlertDialog open={cancelDialogOpen} onOpenChange={(open) => !isCancelling && setCancelDialogOpen(open)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                <AlertDialogDescription>
                  You&apos;ll keep access until the end of your current billing period, then your subscription will not
                  renew. This does not issue a refund for the current period.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isCancelling}>Keep Subscription</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancelSubscription}
                  disabled={isCancelling}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isCancelling ? "Cancelling..." : "Cancel Subscription"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Billing Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">{t("settings.billing.billingInformation")}</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("settings.billing.plan")}</span>
                  <span className="font-medium text-foreground flex items-center gap-2">
                    {plan?.name || "-"}
                    {subscription?.is_founding && (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Founding rate</Badge>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Payment</span>
                  <span className="font-medium text-foreground">{isSplit ? "12 monthly instalments" : "Paid in full, annually"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-medium text-foreground">
                    {subscription?.locked_price_cents ? formatPrice(subscription.locked_price_cents) : "-"}/year
                  </span>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}