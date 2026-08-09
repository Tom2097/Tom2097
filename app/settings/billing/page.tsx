"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Check, CreditCard, Clock, AlertCircle, Loader2, Shield, Gift, XCircle } from "lucide-react"
import { Logo } from "@/components/digit/logo"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { getPlanById, formatPrice } from "@/lib/products"
import { createBillingPortalSession } from "@/app/actions/stripe"
import { useRouter } from "next/navigation"
import { isWithinRefundWindowClient } from "@/lib/billing/subscription-lifecycle-client"
import { trackRefundRequested } from "@/lib/analytics/billing-events"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
  billing_interval: "month" | "year" | null
  cancel_at_period_end: boolean | null
}

export default function BillingSettingsPage() {
  const { t } = useI18n()
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refundReason, setRefundReason] = useState("")
  const [isRequestingRefund, setIsRequestingRefund] = useState(false)
  const [refundRequested, setRefundRequested] = useState(false)
  const [withinRefundWindow, setWithinRefundWindow] = useState(false)
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
          .select("plan_id, status, current_period_end, trial_ends_at, billing_interval, cancel_at_period_end")
          .eq("organization_id", profile.organization_id)
          .single()

        if (sub) {
          setSubscription(sub)
          const withinWindow = await isWithinRefundWindowClient(profile.organization_id)
          setWithinRefundWindow(withinWindow)
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

  const handleRequestRefund = async () => {
    if (!subscription || !withinRefundWindow) return

    try {
      setIsRequestingRefund(true)
      setError(null)

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user?.id)
        .single()

      if (!user || !profile?.organization_id) {
        throw new Error(t("settings.billing.authRequired"))
      }

      const response = await fetch('/api/v1/billing/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: refundReason }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t("settings.billing.failedRefund"))
      }

      await trackRefundRequested(profile.organization_id, user.id, subscription.plan_id, refundReason)
      setRefundRequested(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.billing.failedRefund"))
    } finally {
      setIsRequestingRefund(false)
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
  const isMonthly = subscription?.billing_interval === "month"

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
                    {plan ? formatPrice(plan.priceInCents) : "-"}
                  </p>
                  <p className="text-sm text-muted-foreground">{t("settings.billing.perMonth")}</p>
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

          {/* Refund Section */}
          {isMonthly && !isTrial && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Card className="p-6 mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">{t("settings.billing.refundRequest")}</h3>
                
                {refundRequested ? (
                  <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{t("settings.billing.refundReceived")}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Your refund request has been received. Processing may take 3-5 business days.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : withinRefundWindow ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      You can request a full refund within 30 days of your first payment. After this period, refunds are not available.
                    </p>
                    
                    <div className="space-y-2">
                      <Label htmlFor="refund-reason">{t("settings.billing.refundReasonLabel")}</Label>
                      <Textarea
                        id="refund-reason"
                        placeholder={t("settings.billing.refundReasonPlaceholder")}
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value)}
                        className="min-h-[100px]"
                      />
                    </div>
                    
                    <Button
                      onClick={handleRequestRefund}
                      disabled={isRequestingRefund}
                      className="gap-2"
                    >
                      {isRequestingRefund ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Shield className="w-4 h-4" />
                          Request Refund
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{t("settings.billing.refundWindowExpired")}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Refunds are only available within 30 days of your first payment. You are no longer eligible for a refund.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {/* Cancel Subscription */}
          {subscription && subscription.status !== "cancelled" && subscription.status !== "refunded" && (
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
                      Cancelling stops future renewals. You&apos;ll keep access until the end of your current billing
                      period{isMonthly ? "" : " (yearly plans require a minimum 3-month commitment before they can be cancelled)"}.
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
                  <span className="font-medium text-foreground">{plan?.name || "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("settings.billing.billingCycle")}</span>
                  <span className="font-medium text-foreground">{isMonthly ? t("settings.billing.monthly") : t("settings.billing.annual")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-medium text-foreground">
                    {plan ? formatPrice(plan.priceInCents) : "-"}/month
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