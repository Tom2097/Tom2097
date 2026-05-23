"use client"

import { useEffect, useState, useTransition, Suspense } from "react"
import { motion } from "framer-motion"
import { 
  CreditCard, 
  Users, 
  Building2, 
  Shield, 
  Key,
  ChevronRight,
  Check,
  AlertCircle,
  Download,
  ExternalLink,
  Loader2
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { createBillingPortalSession } from "@/app/actions/stripe"
import { SUBSCRIPTION_PLANS, formatPrice, getPlanById } from "@/lib/products"
import { UsageTracking } from "@/components/digit/usage-tracking"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

interface Profile {
  id: string
  email: string
  full_name: string | null
  role: string
  organization_id: string
}

interface Organization {
  id: string
  name: string
  slug: string
}

interface Subscription {
  id: string
  plan_id: string
  status: string
  current_period_end: string | null
  cancel_at_period_end: boolean
  stripe_customer_id: string | null
}

// Separate component to use searchParams with Suspense
function SuccessBanner() {
  const searchParams = useSearchParams()
  const success = searchParams.get("success")
  
  if (!success) return null
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600"
    >
      <Check className="w-5 h-5" />
      <span>Your subscription has been activated successfully!</span>
    </motion.div>
  )
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [twoFactorAuth, setTwoFactorAuth] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (profileData) {
        setProfile(profileData)

        // Fetch organization
        if (profileData.organization_id) {
          const { data: orgData } = await supabase
            .from("organizations")
            .select("*")
            .eq("id", profileData.organization_id)
            .single()

          if (orgData) {
            setOrganization(orgData)
          }

          // Fetch subscription
          const { data: subData } = await supabase
            .from("subscriptions")
            .select("*")
            .eq("organization_id", profileData.organization_id)
            .single()

          if (subData) {
            setSubscription(subData)
          }
        }
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  const handleManageBilling = () => {
    startTransition(async () => {
      try {
        const { url } = await createBillingPortalSession()
        if (url) {
          window.location.href = url
        }
      } catch (error) {
        console.error("Failed to create billing portal session:", error)
      }
    })
  }

  const currentPlan = subscription ? getPlanById(subscription.plan_id) : null

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8 p-6 md:p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your subscription, team, and preferences</p>
      </div>

      {/* Success Banner */}
      <Suspense fallback={null}>
        <SuccessBanner />
      </Suspense>

      <Tabs defaultValue="subscription" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="subscription" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Subscription
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="w-4 h-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="organization" className="gap-2">
            <Building2 className="w-4 h-4" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="w-4 h-4" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Subscription Tab */}
        <TabsContent value="subscription" className="space-y-6">
          {/* Current Plan */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-6 border-primary/20 bg-primary/5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-semibold text-foreground">
                      {currentPlan?.name || "Free Trial"} Plan
                    </h2>
                    <Badge 
                      variant="secondary" 
                      className={subscription?.status === "active" 
                        ? "bg-chart-2/20 text-chart-2 border-chart-2/30"
                        : "bg-amber-500/20 text-amber-600 border-amber-500/30"
                      }
                    >
                      {subscription?.status || "trialing"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {currentPlan 
                      ? `${formatPrice(currentPlan.priceInCents)}/month`
                      : "14-day free trial with full access"
                    }
                  </p>
                </div>
                <div className="flex gap-3">
                  {subscription?.stripe_customer_id ? (
                    <Button onClick={handleManageBilling} disabled={isPending}>
                      {isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ExternalLink className="w-4 h-4 mr-2" />
                      )}
                      Manage Billing
                    </Button>
                  ) : (
                    <Button asChild>
                      <Link href="/pricing">
                        Upgrade Plan
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>

              {/* Plan Features */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">Plan Features</p>
                  <ul className="space-y-2">
                    {(currentPlan?.features || [
                      "14-day free trial",
                      "Access to all features",
                      "Full AI capabilities",
                      "Priority support"
                    ]).slice(0, 5).map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">Billing Period</p>
                  {subscription?.current_period_end ? (
                    <div className="space-y-2">
                      <p className="text-sm">
                        Next billing date:{" "}
                        <span className="font-medium text-foreground">
                          {new Date(subscription.current_period_end).toLocaleDateString()}
                        </span>
                      </p>
                      {subscription.cancel_at_period_end && (
                        <div className="flex items-center gap-2 text-amber-600 text-sm">
                          <AlertCircle className="w-4 h-4" />
                          Cancels at end of billing period
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Trial period - no billing until you upgrade
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Available Plans */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="text-lg font-semibold mb-4">Available Plans</h3>
            <div className="grid md:grid-cols-3 gap-4">
              {SUBSCRIPTION_PLANS.map((plan) => (
                <Card 
                  key={plan.id}
                  className={`p-6 ${
                    subscription?.plan_id === plan.id 
                      ? "border-primary bg-primary/5" 
                      : "border-border/50 bg-card/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-semibold">{plan.name}</h4>
                    {subscription?.plan_id === plan.id && (
                      <Badge>Current</Badge>
                    )}
                    {plan.popular && subscription?.plan_id !== plan.id && (
                      <Badge variant="secondary">Popular</Badge>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-2xl font-bold">{formatPrice(plan.priceInCents)}</span>
                    <span className="text-muted-foreground text-sm">/month</span>
                  </div>
                  <ul className="space-y-2 mb-4">
                    {plan.features.slice(0, 4).map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="w-3 h-3 text-primary flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {subscription?.plan_id !== plan.id && (
                    <Button variant="outline" className="w-full" asChild>
                      <Link href="/pricing">
                        {!subscription?.plan_id ? "Start Trial" : "Upgrade"}
                      </Link>
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          </motion.div>

          {/* Usage Tracking */}
          {currentPlan && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-lg font-semibold mb-4">Usage & Limits</h3>
              <UsageTracking 
                plan={currentPlan}
                usage={{
                  dataPoints: Math.floor(currentPlan.limits.dataPoints * 0.65),
                  apiCalls: Math.floor(currentPlan.limits.apiCalls * 0.45),
                  teamMembers: 3,
                  modulesUsed: Math.min(2, currentPlan.limits.modules)
                }}
              />
            </motion.div>
          )}
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-6 border-border/50 bg-card/50">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Team Members</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage who has access to your organization
                  </p>
                </div>
                <Button>
                  <Users className="w-4 h-4 mr-2" />
                  Invite Member
                </Button>
              </div>

              {/* Current User */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{profile?.full_name || 'User'}</p>
                    <p className="text-xs text-muted-foreground">{profile?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="secondary" className="bg-chart-2/20 text-chart-2">
                    active
                  </Badge>
                  <Badge>{profile?.role || 'owner'}</Badge>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mt-4">
                Invite team members to collaborate on your AI analytics dashboard.
              </p>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Organization Tab */}
        <TabsContent value="organization" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-6 border-border/50 bg-card/50">
              <h3 className="text-lg font-semibold text-foreground mb-6">Organization Details</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input 
                    id="orgName"
                    defaultValue={organization?.name || ""} 
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgSlug">Organization URL</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">digit.app/</span>
                    <Input 
                      id="orgSlug"
                      defaultValue={organization?.slug || ""} 
                      className="bg-secondary/50"
                    />
                  </div>
                </div>
              </div>
              <Button className="mt-6">Save Changes</Button>
            </Card>
          </motion.div>

          {/* API Keys */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-6 border-border/50 bg-card/50">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">API Keys</h3>
                  <p className="text-sm text-muted-foreground">Manage your API access keys for integrations</p>
                </div>
                <Button>
                  <Key className="w-4 h-4 mr-2" />
                  Generate Key
                </Button>
              </div>
              <div className="text-center py-8 text-muted-foreground">
                <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No API keys created yet</p>
                <p className="text-sm mt-2">Generate an API key to integrate DigiT with your systems</p>
              </div>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-6 border-border/50 bg-card/50">
              <h3 className="text-lg font-semibold text-foreground mb-6">Security Settings</h3>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
                      <p className="text-xs text-muted-foreground">Add an extra layer of security to your account</p>
                    </div>
                  </div>
                  <Switch checked={twoFactorAuth} onCheckedChange={setTwoFactorAuth} />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Email Notifications</p>
                      <p className="text-xs text-muted-foreground">Receive security alerts via email</p>
                    </div>
                  </div>
                  <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-6 border-border/50 bg-card/50">
              <h3 className="text-lg font-semibold text-foreground mb-6">Change Password</h3>
              <div className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input id="currentPassword" type="password" className="bg-secondary/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input id="newPassword" type="password" className="bg-secondary/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input id="confirmPassword" type="password" className="bg-secondary/50" />
                </div>
                <Button>Update Password</Button>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-6 border-destructive/20 bg-destructive/5">
              <h3 className="text-lg font-semibold text-destructive mb-2">Danger Zone</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Once you delete your account, there is no going back. Please be certain.
              </p>
              <Button variant="destructive">Delete Account</Button>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
