"use client"
import { T } from "@/components/i18n/t"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { motion } from "framer-motion"
import { Loader2, CheckCircle2, ShieldCheck, Ticket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Logo } from "@/components/digit/logo"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { formatPrice, SUBSCRIPTION_PLANS } from "@/lib/products"
import { COUNTRIES } from "@/lib/countries"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "")
const plan = SUBSCRIPTION_PLANS[0]

/** Preview only -- mirrors lib/billing/discounts.ts's applyDiscount; the
 *  price actually locked is computed server-side at confirmation. */
function discounted(cents: number, d: { type: "percentage" | "fixed"; value: number }): number {
  return d.type === "percentage" ? Math.round(cents * (1 - d.value / 100)) : Math.max(0, cents - d.value * 100)
}

type Step = "loading" | "details" | "payment" | "success" | "error"

interface BillingDetails {
  legalName: string
  billingEmail: string
  country: string
}

/** Sign-up -> billing details -> confirm a payment method (zero money
 *  taken) -> trial activates only on that confirmation. Annual is charged
 *  once at trial end; monthly is a real recurring Stripe subscription the
 *  customer can cancel anytime (see lib/billing/signup-stripe.ts). */
export default function CheckoutPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("loading")
  const [error, setError] = useState<string | null>(null)
  const [details, setDetails] = useState<BillingDetails>({ legalName: "", billingEmail: "", country: "US" })
  const [billingInterval, setBillingInterval] = useState<"year" | "month">("year")
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  // Optional discount code: pre-checked here for the price preview, then
  // re-validated and claimed server-side by /api/v1/billing/v2/confirm.
  const [discountInput, setDiscountInput] = useState("")
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; type: "percentage" | "fixed"; value: number } | null>(null)
  const [discountError, setDiscountError] = useState<string | null>(null)
  const [checkingDiscount, setCheckingDiscount] = useState(false)

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login?redirect=/checkout")
        return
      }
      // /billing/plans links here as /checkout?code=XXXX after validating one.
      const prefill = new URLSearchParams(window.location.search).get("code")
      if (prefill) setDiscountInput(prefill.toUpperCase())
      setStep("details")
    }
    check()
  }, [router])

  const applyDiscountCode = useCallback(async () => {
    const code = discountInput.trim().toUpperCase()
    setDiscountError(null)
    if (!code) return
    setCheckingDiscount(true)
    try {
      const res = await fetch("/api/v1/billing/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, plan: plan.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.valid) {
        setAppliedDiscount({ code, type: data.discountType === "fixed" ? "fixed" : "percentage", value: Number(data.discount) })
      } else {
        setAppliedDiscount(null)
        setDiscountError(data.reason || data.error || "Invalid discount code")
      }
    } catch {
      setDiscountError("Could not check this code. Try again.")
    } finally {
      setCheckingDiscount(false)
    }
  }, [discountInput])

  const submitDetails = useCallback(async () => {
    setError(null)
    if (!details.legalName.trim() || !details.billingEmail.trim() || !details.country.trim()) {
      setError("All fields are required")
      return
    }
    if (discountInput.trim() && !appliedDiscount) {
      setError("Apply the discount code or clear it before continuing")
      return
    }
    try {
      const signupRes = await fetch("/api/v1/billing/v2/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details),
      })
      const signupData = await signupRes.json()
      if (!signupRes.ok) throw new Error(signupData.error || "Failed to save billing details")

      const setupRes = await fetch("/api/v1/billing/v2/setup-intent", { method: "POST" })
      const setupData = await setupRes.json()
      if (!setupRes.ok) throw new Error(setupData.error || "Failed to start payment setup")

      setClientSecret(setupData.clientSecret)
      setStep("payment")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    }
  }, [details, discountInput, appliedDiscount])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Logo size="md" />
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-6 py-12 max-w-lg">
        {step === "loading" && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {step === "details" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl font-bold text-foreground mb-2"><T>Start your free trial</T></h1>
            <p className="text-muted-foreground mb-6">
              {formatPrice(plan.annualPriceInCents)}/year or {formatPrice(plan.priceInCents)}/month, cancel anytime.
              {" "}1-month free trial. Your card is authorized now but not charged until the trial ends.
            </p>

            <Card className="p-6 space-y-4">
              <div className="space-y-2">
                <Label><T>Billing</T></Label>
                <RadioGroup value={billingInterval} onValueChange={(v) => setBillingInterval(v as "year" | "month")}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="year" id="year" />
                    <Label htmlFor="year" className="font-normal">Annual -- {formatPrice(plan.annualPriceInCents)}/year</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="month" id="month" />
                    <Label htmlFor="month" className="font-normal">Monthly -- {formatPrice(plan.priceInCents)}/month, cancel anytime</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="legalName"><T>Company legal name</T></Label>
                <Input id="legalName" value={details.legalName} onChange={(e) => setDetails((d) => ({ ...d, legalName: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingEmail"><T>Billing email</T></Label>
                <Input id="billingEmail" type="email" value={details.billingEmail} onChange={(e) => setDetails((d) => ({ ...d, billingEmail: e.target.value }))} placeholder="billing@yourcompany.com" />
                <p className="text-xs text-muted-foreground"><T>Invoices and trial-ending reminders go here -- use a company address, not a personal one.</T></p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country"><T>Country</T></Label>
                <Select value={details.country} onValueChange={(v) => setDetails((d) => ({ ...d, country: v }))}>
                  <SelectTrigger id="country" className="w-full">
                    <SelectValue placeholder="Select a country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discountCode"><T>Discount code (optional)</T></Label>
                <div className="flex gap-2">
                  <Input
                    id="discountCode"
                    value={discountInput}
                    onChange={(e) => { setDiscountInput(e.target.value); setAppliedDiscount(null); setDiscountError(null) }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyDiscountCode() } }}
                    placeholder="FOUNDER30"
                  />
                  <Button type="button" variant="outline" onClick={applyDiscountCode} disabled={checkingDiscount || !discountInput.trim()}>
                    {checkingDiscount ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                  </Button>
                </div>
                {discountError && <p className="text-xs text-destructive">{discountError}</p>}
                {appliedDiscount && (
                  <p className="flex items-center gap-1 text-xs text-emerald-500">
                    <Ticket className="w-3 h-3" />
                    {appliedDiscount.code} applied: {formatPrice(discounted(plan.annualPriceInCents, appliedDiscount))}/year or {formatPrice(discounted(plan.priceInCents, appliedDiscount))}/month
                  </p>
                )}
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button className="w-full" onClick={submitDetails}><T>Continue to payment</T></Button>
            </Card>
          </motion.div>
        )}

        {step === "payment" && clientSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentStep
              billingInterval={billingInterval}
              discountCode={appliedDiscount?.code ?? null}
              onSuccess={() => setStep("success")}
              onError={(msg) => setError(msg)}
            />
            {error && <p className="text-sm text-destructive mt-4">{error}</p>}
          </Elements>
        )}

        {step === "success" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-6 text-emerald-500" />
            <h1 className="text-2xl font-bold text-foreground mb-2"><T>You&apos;re all set</T></h1>
            <p className="text-muted-foreground mb-8"><T>Your trial has started. Full product access, right now.</T></p>
            <Button asChild size="lg">
              <Link href="/"><T>Go to dashboard</T></Link>
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  )
}

function PaymentStep({
  billingInterval,
  discountCode,
  onSuccess,
  onError,
}: {
  billingInterval: "year" | "month"
  discountCode: string | null
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = useCallback(async () => {
    if (!stripe || !elements) return
    setSubmitting(true)
    onError("")

    const { error: submitError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    })

    if (submitError || !setupIntent) {
      onError(submitError?.message || "Payment method could not be confirmed")
      setSubmitting(false)
      return
    }

    try {
      const res = await fetch("/api/v1/billing/v2/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupIntentId: setupIntent.id, billingInterval, ...(discountCode ? { discountCode } : {}) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to activate trial")
      onSuccess()
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to activate trial")
    } finally {
      setSubmitting(false)
    }
  }, [stripe, elements, billingInterval, discountCode, onSuccess, onError])

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
        <span><T>Your payment method is verified now, at zero cost. Nothing is charged until your trial ends.</T></span>
      </div>
      <PaymentElement />
      <Button className="w-full" onClick={handleConfirm} disabled={!stripe || submitting}>
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm and start trial"}
      </Button>
    </Card>
  )
}
