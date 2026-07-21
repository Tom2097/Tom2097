"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { loadStripe } from "@stripe/stripe-js"
import { YearlyPlanConfirmation } from "@/components/billing/YearlyPlanConfirmation"
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import { Logo } from "@/components/digit/logo"
import { 
  ArrowLeft, 
  Check, 
  Shield, 
  CreditCard, 
  Lock,
  Building2,
  Rocket,
  AlertCircle,
  Loader2,
  Sparkles,
  ChevronRight,
  BadgeCheck,
  Clock,
  Gift,
  Zap
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { createPaymentIntent, confirmSubscription, setupTrialSubscription, confirmTrialSubscription } from "@/app/actions/payment"
import { getPlanById, formatPrice } from "@/lib/products"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
)

const planIcons = {
  starter: Rocket,
  professional: Zap,
  enterprise: Building2
}

// Payment Form Component (inside Elements provider)
function CheckoutForm({ 
  plan, 
  onSuccess, 
  onError,
  isTrial,
  clientSecret,
  setupIntentId: initialSetupIntentId,
}: { 
  plan: NonNullable<ReturnType<typeof getPlanById>>
  onSuccess: () => void
  onError: (error: string) => void
  isTrial: boolean
  clientSecret?: string | null
  setupIntentId?: string | null
}) {
  const stripe = useStripe()
  const elements = useElements()
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [billingName, setBillingName] = useState("")
  const [billingEmail, setBillingEmail] = useState("")
  const [saveCard, setSaveCard] = useState(true)
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success" | "error">("idle")
  const { t } = useI18n()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)
    setPaymentStatus("processing")

    try {
      if (isTrial) {
        const { error, setupIntent } = await stripe.confirmSetup({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/checkout/success?plan=${plan.id}`,
            payment_method_data: {
              billing_details: {
                name: billingName,
                email: billingEmail,
              },
            },
          },
          redirect: "if_required",
        })

        if (error) {
          setPaymentStatus("error")
          onError(error instanceof Error ? error.message : t("checkout.page.cardSetupFailed"))
          setIsProcessing(false)
        } else if (setupIntent && setupIntent.status === "succeeded") {
          try {
            await confirmTrialSubscription(setupIntent.id, plan.id)
            setPaymentStatus("success")
            setTimeout(() => onSuccess(), 2000)
          } catch (subError) {
            setPaymentStatus("error")
            onError(t("checkout.page.trialSetupFailed"))
            setIsProcessing(false)
          }
        }
      } else {
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/checkout/success?plan=${plan.id}`,
            payment_method_data: {
              billing_details: {
                name: billingName,
                email: billingEmail,
              },
            },
          },
          redirect: "if_required",
        })

        if (error) {
          setPaymentStatus("error")
          onError(error instanceof Error ? error.message : t("checkout.page.paymentFailed"))
          setIsProcessing(false)
        } else if (paymentIntent && paymentIntent.status === "succeeded") {
          try {
            await confirmSubscription(paymentIntent.id, plan.id)
            setPaymentStatus("success")
            setTimeout(() => onSuccess(), 2000)
          } catch (subError) {
            setPaymentStatus("error")
            onError(t("checkout.page.subscriptionSetupFailed"))
            setIsProcessing(false)
          }
        }
      }
    } catch (err) {
      setPaymentStatus("error")
      onError(t("checkout.page.unexpectedError"))
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 relative">
      {/* Payment Status Overlays */}
      <AnimatePresence>
        {paymentStatus === "processing" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl -m-6 p-6"
          >
            <div className="text-center">
              <div className="relative inline-block">
                <motion.div
                  className="w-20 h-20 rounded-full border-4 border-primary/20"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
                <motion.div
                  className="absolute inset-0 w-20 h-20 rounded-full border-4 border-transparent border-t-primary"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                <CreditCard className="absolute inset-0 m-auto w-8 h-8 text-primary" />
              </div>
              <p className="mt-6 text-lg font-semibold text-foreground">{t("checkout.page.processingOverlay")}</p>
              <p className="text-sm text-muted-foreground mt-2">{t("checkout.page.processingDesc")}</p>
              <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
                <Lock className="w-3 h-3" />
                <span>{t("checkout.page.securedByStripe")}</span>
              </div>
            </div>
          </motion.div>
        )}

        {paymentStatus === "success" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl -m-6 p-6"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.6 }}
                className="relative inline-block"
              >
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="w-10 h-10 text-emerald-500" />
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="absolute -top-1 -right-1"
                >
                  <Sparkles className="w-6 h-6 text-amber-500" />
                </motion.div>
              </motion.div>
              <p className="mt-6 text-lg font-semibold text-foreground">{t("checkout.page.paymentSuccessful")}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Welcome to DigiT {plan.name}. Redirecting...
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Billing Information */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
            1
          </div>
          <h3 className="font-semibold text-foreground">{t("checkout.page.billingInformation")}</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="billingName">{t("checkout.page.fullNameLabel")}</Label>
            <Input
              id="billingName"
              placeholder={t("checkout.page.fullNamePlaceholder")}
              value={billingName}
              onChange={(e) => setBillingName(e.target.value)}
              required
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billingEmail">{t("checkout.page.emailLabel")}</Label>
            <Input
              id="billingEmail"
              type="email"
              placeholder={t("checkout.page.emailPlaceholder")}
              value={billingEmail}
              onChange={(e) => setBillingEmail(e.target.value)}
              required
              className="h-11"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Payment Method */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
            2
          </div>
          <h3 className="font-semibold text-foreground">{t("checkout.page.paymentMethod")}</h3>
        </div>
        
        <div className="p-4 rounded-xl border border-border bg-muted/20">
          <PaymentElement 
            options={{
              layout: {
                type: "tabs",
                defaultCollapsed: false,
              },
              business: {
                name: "DigiT Enterprise Intelligence",
              },
            }}
          />
        </div>
      </div>

      <Separator />

      {/* Save Card */}
      <div className="flex items-center space-x-2">
        <Checkbox 
          id="saveCard" 
          checked={saveCard}
          onCheckedChange={(checked) => setSaveCard(checked === true)}
        />
        <label
          htmlFor="saveCard"
          className="text-sm text-muted-foreground cursor-pointer"
        >
          Save this payment method for future billing
        </label>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        size="lg"
        className="w-full h-12 text-base"
        disabled={!stripe || !elements || isProcessing}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            {isTrial ? t("checkout.page.setupTrial") : t("checkout.page.processingPayment")}
          </>
        ) : isTrial ? (
          <>
            <Gift className="w-4 h-4 mr-2" />
            Start 7-Day Free Trial
            <ChevronRight className="w-4 h-4 ml-2" />
          </>
        ) : (
          <>
            <Lock className="w-4 h-4 mr-2" />
            Pay {formatPrice(plan.priceInCents)}
            <ChevronRight className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>

      {/* Terms */}
      <p className="text-xs text-center text-muted-foreground">
        By completing this purchase, you agree to our{" "}
        <Link href="/terms" className="text-primary hover:underline">{t("checkout.page.termsOfService")}</Link>
        {" "}and{" "}
        <Link href="/privacy" className="text-primary hover:underline">{t("checkout.page.privacyPolicy")}</Link>.
      </p>
    </form>
  )
}

export default function CheckoutPage() {
  const { t } = useI18n()
  const params = useParams()
  const router = useRouter()
  const planId = (params?.planId as string) || "" 
  const plan = getPlanById(planId)
  
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [setupIntentId, setSetupIntentId] = useState<string | null>(null)
  const [step, setStep] = useState<"review" | "payment" | "confirmation">("review")
  const [showYearlyConfirmation, setShowYearlyConfirmation] = useState(false)

  const PlanIcon = plan ? planIcons[planId as keyof typeof planIcons] || Zap : Zap
  const isTrial = plan ? plan.interval === "month" : true

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push(`/auth/sign-up?plan=${planId}`)
        return
      }
      
      setUser(user)
      setLoading(false)
    }
    
    checkAuth()
  }, [planId, router])

  const handleProceedToPayment = async () => {
    try {
      setError(null)
      
      if (!isTrial) {
        // Yearly plan - show confirmation first
        setShowYearlyConfirmation(true)
        return
      }
      
      // Monthly plan - proceed directly to payment
      setStep("payment")
      
      const result = await setupTrialSubscription(planId)
      if (!result.clientSecret) {
        throw new Error("Failed to initialize trial setup")
      }
      setClientSecret(result.clientSecret)
      setSetupIntentId(result.setupIntentId)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start checkout"
      setError(message)
      setStep("review")
    }
  }

  const handleYearlyConfirmation = async () => {
    try {
      setShowYearlyConfirmation(false)
      setStep("payment")
      
      const { clientSecret } = await createPaymentIntent(planId)
      if (!clientSecret) {
        throw new Error("Failed to initialize payment")
      }
      setClientSecret(clientSecret)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start checkout"
      setError(message)
      setStep("review")
    }
  }

  const handlePaymentSuccess = () => {
    router.push(`/checkout/success?plan=${planId}`)
  }

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage)
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <h1 className="text-xl font-bold mb-2">{t("checkout.page.planNotFoundTitle")}</h1>
          <p className="text-muted-foreground mb-6">
            The selected plan does not exist or is no longer available.
          </p>
          <Button asChild>
            <Link href="/pricing">{t("checkout.page.viewPlans")}</Link>
          </Button>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">{t("checkout.page.preparingCheckout")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Yearly Plan Confirmation */}
      {showYearlyConfirmation && plan && (
        <YearlyPlanConfirmation
          planName={plan.name}
          onConfirm={handleYearlyConfirmation}
          onCancel={() => setShowYearlyConfirmation(false)}
        />
      )}
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/pricing">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <Logo size="md" />
              <p className="text-xs text-muted-foreground ml-2 hidden sm:block">{t("checkout.page.secureCheckout")}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4 text-emerald-500" />
              <span>{t("checkout.page.sslEncrypted")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="w-4 h-4" />
              <span>{t("checkout.page.poweredByStripe")}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="border-b border-border/50 bg-background/50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            {[
              { num: 1, label: t("checkout.page.review") },
              { num: 2, label: t("checkout.page.payment") },
              { num: 3, label: t("checkout.page.complete") }
            ].map((s, i) => (
              <div key={s.num} className="flex items-center">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    step === "review" && s.num === 1
                      ? "bg-primary text-primary-foreground"
                      : step === "payment" && s.num <= 2
                        ? s.num === 2 ? "bg-primary text-primary-foreground" : "bg-emerald-500 text-white"
                        : "bg-muted text-muted-foreground"
                  }`}>
                    {(step === "payment" && s.num === 1) ? (
                      <Check className="w-4 h-4" />
                    ) : s.num}
                  </div>
                  <span className={`hidden sm:inline text-sm font-medium ${
                    (step === "review" && s.num === 1) || (step === "payment" && s.num === 2)
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}>
                    {s.label}
                  </span>
                </div>
                {i < 2 && (
                  <div className="w-8 sm:w-16 h-px bg-border mx-2 sm:mx-4" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="container mx-auto px-6 pt-6"
          >
            <div className="max-w-5xl mx-auto">
              <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/10">
                <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-destructive">Payment Error</p>
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setError(null)}
                  className="text-muted-foreground"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-6 py-8 sm:py-12">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-5 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 order-2 lg:order-1">
            <AnimatePresence mode="wait">
              {step === "review" ? (
                <motion.div
                  key="review"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">{t("checkout.page.reviewOrder")}</h2>
                    <p className="text-muted-foreground">
                      You&apos;re about to subscribe to {plan.name}. Review the details below.
                    </p>
                  </div>

                  {/* Plan Details Card */}
                  <Card className="p-6 border-primary/20 bg-gradient-to-br from-primary/5 to-cyan-500/5">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center flex-shrink-0">
                        <PlanIcon className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold text-foreground">{plan.name} Plan</h3>
                          {plan.popular && <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">{t("checkout.page.mostPopular")}</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-foreground">
                            {formatPrice(plan.priceInCents)}
                          </span>
                          <span className="text-muted-foreground">{t("checkout.page.perMonth")}</span>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Features */}
                  <Card className="p-6 border-border/50">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
                      What&apos;s Included
                    </h4>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {plan.features.map((feature, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-3 h-3 text-emerald-500" />
                          </div>
                          <span className="text-sm text-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Plan Limits */}
                  <Card className="p-6 border-border/50">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
                      Plan Limits
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: t("checkout.page.teamMembers"), value: plan.limits.users === -1 ? t("checkout.page.unlimited") : plan.limits.users },
                        { label: t("checkout.page.aiModules"), value: plan.limits.modules },
                        { label: t("checkout.page.dataPoints"), value: plan.limits.dataPoints === -1 ? t("checkout.page.unlimited") : `${(plan.limits.dataPoints / 1000000).toFixed(0)}M` },
                        { label: t("checkout.page.apiCalls"), value: plan.limits.apiCalls === -1 ? t("checkout.page.unlimited") : `${(plan.limits.apiCalls / 1000).toFixed(0)}K` },
                      ].map((item, i) => (
                        <div key={i} className="text-center p-4 rounded-xl bg-muted/30">
                          <p className="text-2xl font-bold text-foreground">{item.value}</p>
                          <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Proceed Button */}
                  <Button 
                    size="lg" 
                    className="w-full h-12"
                    onClick={handleProceedToPayment}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Proceed to Payment
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>

                  {/* Trust Badges */}
                  <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-4">
                    {[
                      { icon: Shield, label: t("checkout.page.soc2") },
                      { icon: Lock, label: t("checkout.page.pciDss") },
                      { icon: BadgeCheck, label: t("checkout.page.gdprReady") },
                    ].map((badge, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <badge.icon className="w-4 h-4" />
                        <span>{badge.label}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-foreground mb-2">{t("checkout.page.completePayment")}</h2>
                      <p className="text-muted-foreground">
                        Enter your payment details to complete your subscription.
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setStep("review")}
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Back
                    </Button>
                  </div>

                  <Card className="p-6 border-border/50">
                    {clientSecret ? (
                      <Elements
                        stripe={stripePromise}
                        options={{
                          clientSecret,
                          appearance: {
                            theme: "stripe",
                            variables: {
                              colorPrimary: "#06b6d4",
                              colorBackground: "#ffffff",
                              colorText: "#1f2937",
                              colorDanger: "#ef4444",
                              fontFamily: "system-ui, sans-serif",
                              borderRadius: "12px",
                              spacingUnit: "4px",
                            },
                            rules: {
                              ".Input": {
                                border: "1px solid #e5e7eb",
                                boxShadow: "none",
                              },
                              ".Input:focus": {
                                border: "1px solid #06b6d4",
                                boxShadow: "0 0 0 1px #06b6d4",
                              },
                              ".Tab": {
                                border: "1px solid #e5e7eb",
                              },
                              ".Tab--selected": {
                                border: "1px solid #06b6d4",
                                backgroundColor: "#ecfeff",
                              },
                            },
                          },
                        }}
                      >
                        <CheckoutForm 
                          plan={plan}
                          onSuccess={handlePaymentSuccess}
                          onError={handlePaymentError}
                          isTrial={isTrial}
                          clientSecret={clientSecret}
                          setupIntentId={setupIntentId}
                        />
                      </Elements>
                    ) : (
                      <div className="py-12 flex items-center justify-center">
                        <div className="text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                          <p className="text-muted-foreground">{t("checkout.page.initializingPayment")}</p>
                        </div>
                      </div>
                    )}
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <div className="lg:sticky lg:top-32">
              <Card className="p-6 border-border/50">
                <h3 className="text-lg font-semibold text-foreground mb-6">{t("checkout.page.orderSummary")}</h3>
                
                  <div className="space-y-4 pb-4 border-b border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("checkout.page.planSuffix")}</span>
                      <span className="font-medium text-foreground">{plan.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("checkout.page.billingCycle")}</span>
                      <span className="font-medium text-foreground">{isTrial ? t("checkout.page.monthlyTrial") : t("checkout.page.annual")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{isTrial ? t("checkout.page.trialPeriod") : t("checkout.page.subtotal")}</span>
                      <span className="font-medium text-foreground">{isTrial ? t("checkout.page.freeFor7Days") : formatPrice(plan.priceInCents)}</span>
                    </div>
                  </div>

                <div className="py-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("checkout.page.tax")}</span>
                    <span className="text-sm text-muted-foreground">{t("checkout.page.calculatedAtCheckout")}</span>
                  </div>
                </div>

                <div className="pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-foreground">{t("checkout.page.total")}</span>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-foreground">
                        {formatPrice(plan.priceInCents)}
                      </span>
                      <p className="text-xs text-muted-foreground">{t("checkout.page.perMonth")}</p>
                    </div>
                  </div>
                </div>

                {/* Trial Info */}
                {isTrial && (
                  <div className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{t("checkout.page.trialTitle")}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Start with full access today. You won&apos;t be charged until day 8.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Guarantee */}
                {isTrial && (
                  <div className="mt-4 p-4 rounded-xl bg-muted/30">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground text-sm">{t("checkout.page.guaranteeTitle")}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Not satisfied? Get a full refund within 30 days.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Plan Info */}
                {!isTrial && (
                  <div className="mt-6 p-4 rounded-xl bg-muted/30">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground text-sm">{t("checkout.page.annualPlanTitle")}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          3-month minimum commitment. No refunds after purchase.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-center text-xs text-muted-foreground mt-6">
                  {isTrial ? t("checkout.page.cancelAnytimeTrial") : t("checkout.page.cancelAnytimeAnnual")}
                </p>
              </Card>

              {/* Compare Plans Link */}
              <div className="mt-4 text-center">
                <Link 
                  href="/pricing" 
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  Compare all plans
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
