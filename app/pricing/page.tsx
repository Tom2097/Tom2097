"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Check, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Logo } from "@/components/digit/logo"
import { useI18n } from "@/components/providers/i18n-provider"
import { AuroraBackground } from "@/components/digit/aurora-background"
import { SUBSCRIPTION_PLANS, formatPrice } from "@/lib/products"

const plan = SUBSCRIPTION_PLANS[0]

export default function PricingPage() {
  const { t } = useI18n()
  const [slots, setSlots] = useState<{ remaining: number; total: number } | null>(null)

  useEffect(() => {
    fetch("/api/v1/billing/v2/founding-slots")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setSlots({ remaining: data.slotsRemaining, total: data.slotsTotal }))
      .catch(() => {})
  }, [])

  const isFoundingAvailable = slots !== null && slots.remaining > 0

  return (
    <div className="min-h-screen bg-background relative">
      <AuroraBackground />

      <header className="relative z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo size="md" />
          </Link>
          <Button variant="outline" asChild>
            <Link href="/auth/login">{t("pricing.header.login") || "Log in"}</Link>
          </Button>
        </div>
      </header>

      <div className="relative z-10 container mx-auto px-6 py-16 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">One platform. One price.</h1>
          <p className="text-lg text-muted-foreground">Every module, every AI capability, no tiers to compare.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
          <Card className="p-8 md:p-10 border-primary/30 relative overflow-hidden">
            {isFoundingAvailable && (
              <Badge className="absolute top-6 right-6 bg-primary/10 text-primary border-primary/30">
                <Sparkles className="w-3 h-3 mr-1" />
                Founding offer
              </Badge>
            )}

            <h2 className="text-xl font-semibold text-foreground mb-1">{plan.name}</h2>
            <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>

            <div className="flex items-baseline gap-3 mb-2">
              {isFoundingAvailable ? (
                <>
                  <span className="text-5xl font-bold text-foreground">{formatPrice(1_000_000)}</span>
                  <span className="text-muted-foreground">/year</span>
                </>
              ) : (
                <>
                  <span className="text-5xl font-bold text-foreground">{formatPrice(plan.priceInCents)}</span>
                  <span className="text-muted-foreground">/year</span>
                </>
              )}
            </div>

            {isFoundingAvailable ? (
              <p className="text-sm text-muted-foreground mb-6">
                Public price {formatPrice(plan.priceInCents)}/year. Locked for as long as you stay, for our first 50 customers.{" "}
                <span className="font-medium text-primary">{slots?.remaining} of {slots?.total} founding slots left.</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mb-6">
                Pay in full, or split into 12 monthly instalments. A 12-month commitment either way.
              </p>
            )}

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8">
              <span>{isFoundingAvailable ? "2-month free trial" : "1-month free trial"}</span>
              <span aria-hidden>·</span>
              <span>No card charged until trial ends</span>
              <span aria-hidden>·</span>
              <span>Cancel anytime during trial</span>
            </div>

            <Button size="lg" className="w-full mb-8" asChild>
              <Link href="/checkout">Start free trial</Link>
            </Button>

            <div className="space-y-3">
              {plan.features.map((feature) => (
                <div key={feature} className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm text-foreground">{feature}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-10 text-center text-sm text-muted-foreground space-y-2"
        >
          <p>No refunds after the trial ends -- access continues for your full paid term. Full data export, always available.</p>
          <p>
            Questions?{" "}
            <a href="mailto:hello@digit-ai.org" className="text-primary hover:underline">
              hello@digit-ai.org
            </a>
          </p>
        </motion.div>
      </div>

      <footer className="relative z-10 border-t border-border/50 py-12 px-6">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="text-sm text-muted-foreground">© {new Date().getFullYear()} DigiT</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/security" className="hover:text-foreground transition-colors">Security</Link>
            <Link href="/status" className="hover:text-foreground transition-colors">Status</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
