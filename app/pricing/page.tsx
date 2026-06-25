"use client"

import { useState, useEffect, Suspense } from "react"
import { motion } from "framer-motion"
import { Check, Zap, Building2, Rocket, ChevronRight, Star, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { pricingTiers, addOns, platformModules } from "@/lib/subscription-data"
import { Checkout } from "@/components/checkout"
import { createClient } from "@/lib/supabase/client"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { Logo } from "@/components/digit/logo"

const tierIcons = {
  starter: Rocket,
  professional: Zap,
  enterprise: Building2
}

// Component that uses useSearchParams
function CanceledBanner() {
  const searchParams = useSearchParams()
  const canceled = searchParams.get("canceled")
  
  if (!canceled) return null
  
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3">
      <p className="text-center text-sm text-amber-600">
        Checkout was canceled. Feel free to try again when you&apos;re ready.
      </p>
    </div>
  )
}

function PricingContent() {
  const [isAnnual, setIsAnnual] = useState(true)
  const [selectedTier, setSelectedTier] = useState<string | null>(null)
  const [showCheckout, setShowCheckout] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })
  }, [])

  const handleSelectPlan = (tierId: string) => {
    if (!user) {
      router.push(`/auth/sign-up?plan=${tierId}`)
      return
    }
    router.push(`/checkout/${tierId}`)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Logo size="md" link />
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <Link href="/pricing" className="text-sm text-foreground font-medium">
              Pricing
            </Link>
            {user ? (
              <Button size="sm" asChild>
                <Link href="/settings">My Account</Link>
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/auth/login">Sign In</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/auth/sign-up">Start Free Trial</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Canceled Banner */}
      <Suspense fallback={null}>
        <CanceledBanner />
      </Suspense>

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,212,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,212,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        <div className="container mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="secondary" className="mb-4">
              <Star className="w-3 h-3 mr-1" />
              Trusted by 500+ Enterprises
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Simple, Transparent{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-chart-2">
                Pricing
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
               Choose the plan that scales with your business. All plans include a 7-day free trial 
               with full access to features.
            </p>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 mb-12">
              <span className={`text-sm ${!isAnnual ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                Monthly
              </span>
              <Switch
                checked={isAnnual}
                onCheckedChange={setIsAnnual}
                className="data-[state=checked]:bg-primary"
              />
              <span className={`text-sm ${isAnnual ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                Annual
              </span>
              {isAnnual && (
                <Badge variant="secondary" className="bg-chart-2/20 text-chart-2 border-chart-2/30">
                  Save 15%
                </Badge>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-12 px-6">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingTiers.map((tier, index) => {
              const TierIcon = tierIcons[tier.id as keyof typeof tierIcons]
              const price = isAnnual ? tier.annualPrice : tier.monthlyPrice

              return (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <Card
                    className={`relative p-8 h-full flex flex-col transition-all duration-300 hover:shadow-xl ${
                      tier.highlighted
                        ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                        : "border-border/50 bg-card/50 hover:border-primary/50"
                    }`}
                  >
                    {tier.highlighted && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground">
                          Most Popular
                        </Badge>
                      </div>
                    )}

                    <div className="mb-6">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                        tier.highlighted ? "bg-primary/20" : "bg-muted"
                      }`}>
                        <TierIcon className={`w-6 h-6 ${tier.highlighted ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <h3 className="text-2xl font-bold text-foreground mb-2">{tier.name}</h3>
                      <p className="text-sm text-muted-foreground">{tier.description}</p>
                    </div>

                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-foreground">${price}</span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                      {isAnnual && (
                        <p className="text-sm text-chart-2 mt-1">
                          Billed annually (${price * 12}/year)
                        </p>
                      )}
                    </div>

                    <div className="flex-1 mb-8">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                        What&apos;s included
                      </p>
                      <ul className="space-y-3">
                        {tier.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                              tier.highlighted ? "text-primary" : "text-chart-2"
                            }`} />
                            <span className="text-sm text-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Button
                      className={`w-full ${
                        tier.highlighted
                          ? "bg-primary hover:bg-primary/90"
                          : tier.id === "enterprise"
                          ? "bg-foreground text-background hover:bg-foreground/90"
                          : ""
                      }`}
                      variant={tier.highlighted ? "default" : tier.id === "enterprise" ? "default" : "outline"}
                      onClick={() => handleSelectPlan(tier.id)}
                    >
                      {tier.cta}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Add-ons Section */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">Enhance Your Plan</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Add extra capabilities to any plan based on your specific needs
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {addOns.map((addon, index) => (
              <motion.div
                key={addon.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="p-6 border-border/50 bg-card/50 hover:border-primary/50 transition-all duration-300">
                  <h3 className="font-semibold text-foreground mb-2">{addon.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{addon.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-foreground">${addon.price}</span>
                    <span className="text-xs text-muted-foreground">/{addon.unit}</span>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Modules */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">Platform Modules</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Configurable AI-powered intelligence for any team or business function
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-4xl mx-auto">
            {platformModules.map((module, index) => (
              <motion.div
                key={module.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <Card className="p-4 text-center border-border/50 bg-card/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 cursor-pointer">
                  <div className="w-10 h-10 rounded-lg bg-muted mx-auto mb-3 flex items-center justify-center">
                    <div className="w-5 h-5 rounded bg-primary/50" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{module.name}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>



      {/* Footer */}
      <footer className="border-t border-border/50 py-12 px-6">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Image src="/logo.jpeg" alt="DigiT" height={24} width={55} className="object-contain" />
              <span className="text-sm text-muted-foreground">
                © 2026 DigiT Enterprise Intelligence. All rights reserved.
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="/security" className="hover:text-foreground transition-colors">Security</Link>
              <Link href="/status" className="hover:text-foreground transition-colors">Status</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Checkout Modal */}
      {showCheckout && selectedTier && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold">
                Subscribe to {pricingTiers.find(t => t.id === selectedTier)?.name}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowCheckout(false)
                  setSelectedTier(null)
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-0">
              <Checkout 
                planId={selectedTier} 
                onClose={() => {
                  setShowCheckout(false)
                  setSelectedTier(null)
                }} 
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function PricingPage() {
  return <PricingContent />
}
