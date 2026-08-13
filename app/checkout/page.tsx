"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { motion } from "framer-motion"
import { Loader2, CheckCircle2, ShieldCheck } from "lucide-react"
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

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login?redirect=/checkout")
        return
      }
      setStep("details")
    }
    check()
  }, [router])

  const submitDetails = useCallback(async () => {
    setError(null)
    if (!details.legalName.trim() || !details.billingEmail.trim() || !details.country.trim()) {
      setError("All fields are required")
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
  }, [details])

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
            <h1 className="text-2xl font-bold text-foreground mb-2">Start your free trial</h1>
            <p className="text-muted-foreground mb-6">
              {formatPrice(plan.annualPriceInCents)}/year or {formatPrice(plan.priceInCents)}/month, cancel anytime.
              {" "}1-month free trial. Your card is authorized now but not charged until the trial ends.
            </p>

            <Card className="p-6 space-y-4">
              <div className="space-y-2">
                <Label>Billing</Label>
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
                <Label htmlFor="legalName">Company legal name</Label>
                <Input id="legalName" value={details.legalName} onChange={(e) => setDetails((d) => ({ ...d, legalName: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingEmail">Billing email</Label>
                <Input id="billingEmail" type="email" value={details.billingEmail} onChange={(e) => setDetails((d) => ({ ...d, billingEmail: e.target.value }))} placeholder="billing@yourcompany.com" />
                <p className="text-xs text-muted-foreground">Invoices and trial-ending reminders go here -- use a company address, not a personal one.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
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

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button className="w-full" onClick={submitDetails}>Continue to payment</Button>
            </Card>
          </motion.div>
        )}

        {step === "payment" && clientSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentStep
              billingInterval={billingInterval}
              onSuccess={() => setStep("success")}
              onError={(msg) => setError(msg)}
            />
            {error && <p className="text-sm text-destructive mt-4">{error}</p>}
          </Elements>
        )}

        {step === "success" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-6 text-emerald-500" />
            <h1 className="text-2xl font-bold text-foreground mb-2">You&apos;re all set</h1>
            <p className="text-muted-foreground mb-8">Your trial has started. Full product access, right now.</p>
            <Button asChild size="lg">
              <Link href="/">Go to dashboard</Link>
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  )
}

function PaymentStep({
  billingInterval,
  onSuccess,
  onError,
}: {
  billingInterval: "year" | "month"
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
        body: JSON.stringify({ setupIntentId: setupIntent.id, billingInterval }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to activate trial")
      onSuccess()
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to activate trial")
    } finally {
      setSubmitting(false)
    }
  }, [stripe, elements, billingInterval, onSuccess, onError])

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Your payment method is verified now, at zero cost. Nothing is charged until your trial ends.</span>
      </div>
      <PaymentElement />
      <Button className="w-full" onClick={handleConfirm} disabled={!stripe || submitting}>
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm and start trial"}
      </Button>
    </Card>
  )
}
