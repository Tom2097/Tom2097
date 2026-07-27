"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { motion } from "framer-motion"
import { Check, Clock, Shield, AlertCircle } from "lucide-react"
import { Logo } from "@/components/digit/logo"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AuroraBackground } from "@/components/digit/aurora-background"
import { InView } from "@/components/motion-primitives/in-view"

const TRIAD = ["#3ce0e2", "#3b7cf5", "#00c875"]

export default function RefundPolicyPage() {
  const { t } = useI18n()
  return (
    <div className="relative min-h-screen bg-background">
      <AuroraBackground />

      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo size="md" />
          </Link>
          <Button variant="outline" asChild>
            <Link href="/pricing">View Plans</Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-6 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              Refund Policy
            </h1>
            <p className="text-lg text-muted-foreground">
              Our refund policy for DigiT Enterprise Intelligence subscriptions
            </p>
          </motion.div>

          {/* Policy Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Card className="p-8 mb-8">
              <div className="space-y-6">
                <InView delay={0 * 0.08}>
                  <h2 className="text-2xl font-bold text-foreground mb-4">Monthly Plans</h2>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                        <Check className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">30-Day Refund Window</h3>
                        <p className="text-muted-foreground mt-1">
                          You can request a full refund within 30 days of your first payment. After this period, refunds are not available.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                        <Clock className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">Trial Period</h3>
                        <p className="text-muted-foreground mt-1">
                          All monthly plans include a 7-day free trial. You won&apos;t be charged until day 8.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">Cancellation</h3>
                        <p className="text-muted-foreground mt-1">
                          You can cancel your subscription at any time. If you cancel within the 30-day refund window, you&apos;ll receive a full refund.
                        </p>
                      </div>
                    </div>
                  </div>
                </InView>

                <InView delay={1 * 0.08}>
                  <h2 className="text-2xl font-bold text-foreground mb-4">Yearly Plans</h2>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                        <Shield className="w-4 h-4 text-red-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">No Refunds</h3>
                        <p className="text-muted-foreground mt-1">
                          Yearly plans are non-refundable. Once purchased, you cannot receive a refund for any unused portion of the subscription.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">3-Month Minimum Commitment</h3>
                        <p className="text-muted-foreground mt-1">
                          Yearly plans require a 3-month minimum commitment. You can cancel after 3 months, but no refund will be issued.
                        </p>
                      </div>
                    </div>
                  </div>
                </InView>

                <InView delay={2 * 0.08}>
                  <h2 className="text-2xl font-bold text-foreground mb-4">How to Request a Refund</h2>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                        style={{ backgroundColor: `${TRIAD[0]}1a` }}
                      >
                        <Check className="w-4 h-4" style={{ color: TRIAD[0] }} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">Eligibility</h3>
                        <p className="text-muted-foreground mt-1">
                          Refunds are only available for monthly plans within 30 days of the first payment.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                        style={{ backgroundColor: `${TRIAD[1]}1a` }}
                      >
                        <Check className="w-4 h-4" style={{ color: TRIAD[1] }} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">Request Process</h3>
                        <p className="text-muted-foreground mt-1">
                          Go to <Link href="/settings/billing" className="text-primary hover:underline">Settings → Billing</Link> and click &quot;Request Refund&quot;.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                        style={{ backgroundColor: `${TRIAD[2]}1a` }}
                      >
                        <Check className="w-4 h-4" style={{ color: TRIAD[2] }} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">Processing Time</h3>
                        <p className="text-muted-foreground mt-1">
                          Refunds typically take 3-5 business days to process and appear on your original payment method.
                        </p>
                      </div>
                    </div>
                  </div>
                </InView>
              </div>
            </Card>

            <div className="text-center">
              <Button asChild>
                <Link href="/settings/billing">
                  Manage Billing
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}