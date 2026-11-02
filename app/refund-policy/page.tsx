"use client"
import { T } from "@/components/i18n/t"
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
            <Link href="/#pricing"><T>View Plans</T></Link>
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
              <T>Refund Policy</T>
            </h1>
            <p className="text-lg text-muted-foreground">
              <T>Our refund policy for DigiT Enterprise Intelligence subscriptions</T>
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
                  <h2 className="text-2xl font-bold text-foreground mb-4"><T>Monthly Plans</T></h2>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                        <Check className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground"><T>30-Day Refund Window</T></h3>
                        <p className="text-muted-foreground mt-1">
                          <T>You can request a full refund within 30 days of your first payment. After this period, refunds are not available.</T>
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                        <Clock className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground"><T>Trial Period</T></h3>
                        <p className="text-muted-foreground mt-1">
                          <T>Every plan, monthly or annual, includes a 1-month free trial. You won&apos;t be charged until the trial ends.</T>
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground"><T>Cancellation</T></h3>
                        <p className="text-muted-foreground mt-1">
                          <T>You can cancel your subscription at any time. If you cancel within the 30-day refund window, you&apos;ll receive a full refund.</T>
                        </p>
                      </div>
                    </div>
                  </div>
                </InView>

                <InView delay={1 * 0.08}>
                  <h2 className="text-2xl font-bold text-foreground mb-4"><T>Yearly Plans</T></h2>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                        <Shield className="w-4 h-4 text-red-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground"><T>No Refunds</T></h3>
                        <p className="text-muted-foreground mt-1">
                          <T>Yearly plans are non-refundable. Once purchased, you cannot receive a refund for any unused portion of the subscription.</T>
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground"><T>3-Month Minimum Commitment</T></h3>
                        <p className="text-muted-foreground mt-1">
                          <T>Yearly plans require a 3-month minimum commitment. You can cancel after 3 months, but no refund will be issued.</T>
                        </p>
                      </div>
                    </div>
                  </div>
                </InView>

                <InView delay={2 * 0.08}>
                  <h2 className="text-2xl font-bold text-foreground mb-4"><T>How to Request a Refund</T></h2>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                        style={{ backgroundColor: `${TRIAD[0]}1a` }}
                      >
                        <Check className="w-4 h-4" style={{ color: TRIAD[0] }} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground"><T>Eligibility</T></h3>
                        <p className="text-muted-foreground mt-1">
                          <T>Refunds are only available for monthly plans within 30 days of the first payment.</T>
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
                        <h3 className="font-semibold text-foreground"><T>Request Process</T></h3>
                        <p className="text-muted-foreground mt-1">
                          <T>Go to</T> <Link href="/settings/billing" className="text-primary hover:underline"><T>Settings → Billing</T></Link> <T>and click &quot;Request Refund&quot;.</T>
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
                        <h3 className="font-semibold text-foreground"><T>Processing Time</T></h3>
                        <p className="text-muted-foreground mt-1">
                          <T>Refunds typically take 3-5 business days to process and appear on your original payment method.</T>
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
                  <T>Manage Billing</T>
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}