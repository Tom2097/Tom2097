"use client"

import { useEffect, useState, useTransition, useCallback, Suspense } from "react"
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
  ExternalLink,
  Loader2,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  X
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { createBillingPortalSession } from "@/app/actions/stripe"
import { SUBSCRIPTION_PLANS, formatPrice, getPlanById } from "@/lib/products"
import { UsageTracking } from "@/components/digit/usage-tracking"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

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

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  created_at: string
  last_used_at: string | null
}

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [twoFactorAuth, setTwoFactorAuth] = useState(false)
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("member")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviting, setInviting] = useState(false)

  // Org state
  const [orgName, setOrgName] = useState("")
  const [orgSlug, setOrgSlug] = useState("")
  const [savingOrg, setSavingOrg] = useState(false)

  // API keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [apiKeysLoading, setApiKeysLoading] = useState(false)
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [generatingKey, setGeneratingKey] = useState(false)
  const [showKey, setShowKey] = useState(false)

  // 2FA state
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [twoFASetupCode, setTwoFASetupCode] = useState("")
  const [twoFASetupOpen, setTwoFASetupOpen] = useState(false)
  const [twoFADisableOpen, setTwoFADisableOpen] = useState(false)
  const [twoFADisableCode, setTwoFADisableCode] = useState("")
  const [verifying2FA, setVerifying2FA] = useState(false)

  // Password state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState("")

  // Delete account state
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const api = useCallback(async (url: string, options?: RequestInit) => {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Request failed")
    return data
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (profileData) {
        setProfile(profileData)
        if (profileData.organization_id) {
          const { data: orgData } = await supabase
            .from("organizations")
            .select("*")
            .eq("id", profileData.organization_id)
            .single()

          if (orgData) {
            setOrganization(orgData)
            setOrgName(orgData.name)
            setOrgSlug(orgData.slug)
          }

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
        if (url) window.location.href = url
      } catch (_error) {
        showToast("error", "Failed to create billing portal session")
      }
    })
  }

  // Invite handler
  const handleInvite = async () => {
    if (!inviteEmail) return
    setInviting(true)
    try {
      await api("/api/v1/auth/invite", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      showToast("success", `Invitation sent to ${inviteEmail}`)
      setInviteOpen(false)
      setInviteEmail("")
    } catch (err: any) {
      showToast("error", err.message)
    } finally {
      setInviting(false)
    }
  }

  // Org save handler
  const handleSaveOrg = async () => {
    if (!orgName) return
    setSavingOrg(true)
    try {
      const data = await api("/api/v1/organization", {
        method: "PUT",
        body: JSON.stringify({ name: orgName, slug: orgSlug }),
      })
      setOrganization(prev => prev ? { ...prev, ...data } : prev)
      showToast("success", "Organization updated")
    } catch (err: any) {
      showToast("error", err.message)
    } finally {
      setSavingOrg(false)
    }
  }

  // API keys handlers
  const fetchApiKeys = async () => {
    setApiKeysLoading(true)
    try {
      const data = await api("/api/v1/api-keys")
      setApiKeys(data.keys)
    } catch {
      // silent
    } finally {
      setApiKeysLoading(false)
    }
  }

  const handleGenerateKey = async () => {
    setGeneratingKey(true)
    try {
      const data = await api("/api/v1/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: "API Key" }),
      })
      setGeneratedKey(data.key)
      setShowKey(true)
      fetchApiKeys()
      showToast("success", "API key generated")
    } catch (err: any) {
      showToast("error", err.message)
    } finally {
      setGeneratingKey(false)
    }
  }

  const handleCopyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey)
      showToast("success", "Key copied to clipboard")
    }
  }

  const handleDeleteKey = async (id: string) => {
    try {
      await api("/api/v1/api-keys", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      })
      setApiKeys(prev => prev.filter(k => k.id !== id))
      showToast("success", "API key revoked")
    } catch (err: any) {
      showToast("error", err.message)
    }
  }

  // 2FA handlers
  const handle2FASetup = async () => {
    try {
      const data = await api("/api/v1/auth/2fa/setup", { method: "POST" })
      setQrCode(data.qrCode)
      setBackupCodes(data.backupCodes)
      setTwoFASetupOpen(true)
    } catch (err: any) {
      showToast("error", err.message)
    }
  }

  const handle2FAVerify = async () => {
    if (!twoFASetupCode) return
    setVerifying2FA(true)
    try {
      await api("/api/v1/auth/2fa/verify", {
        method: "POST",
        body: JSON.stringify({ code: twoFASetupCode }),
      })
      setTwoFactorAuth(true)
      setTwoFASetupOpen(false)
      setQrCode(null)
      setBackupCodes([])
      setTwoFASetupCode("")
      showToast("success", "Two-factor authentication enabled")
    } catch (err: any) {
      showToast("error", err.message)
    } finally {
      setVerifying2FA(false)
    }
  }

  const handle2FADisable = async () => {
    if (!twoFADisableCode) return
    setVerifying2FA(true)
    try {
      await api("/api/v1/auth/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ code: twoFADisableCode }),
      })
      setTwoFactorAuth(false)
      setTwoFADisableOpen(false)
      setTwoFADisableCode("")
      showToast("success", "Two-factor authentication disabled")
    } catch (err: any) {
      showToast("error", err.message)
    } finally {
      setVerifying2FA(false)
    }
  }

  // Password handler
  const handleChangePassword = async () => {
    setPasswordError("")
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required")
      return
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match")
      return
    }
    setChangingPassword(true)
    try {
      await api("/api/v1/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      showToast("success", "Password updated successfully")
    } catch (err: any) {
      setPasswordError(err.message)
    } finally {
      setChangingPassword(false)
    }
  }

  // Delete account handler
  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") return
    setDeleting(true)
    try {
      await api("/api/v1/auth/delete-account", {
        method: "POST",
        body: JSON.stringify({ confirmation: "DELETE" }),
      })
      const supabase = createClient()
      await supabase.auth.signOut()
      window.location.href = "/"
    } catch (err: any) {
      showToast("error", err.message)
    } finally {
      setDeleting(false)
    }
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
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your subscription, team, and preferences</p>
      </div>

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`flex items-center gap-3 p-4 rounded-lg border ${
            toast.type === "success"
              ? "bg-green-500/10 border-green-500/20 text-green-600"
              : "bg-destructive/10 border-destructive/20 text-destructive"
          }`}
        >
          {toast.type === "success" ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{toast.message}</span>
        </motion.div>
      )}

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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
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
                      : "7-day free trial with full access"
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

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">Plan Features</p>
                  <ul className="space-y-2">
                    {(currentPlan?.features || [
                      "7-day free trial",
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

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
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
                    {subscription?.plan_id === plan.id && <Badge>Current</Badge>}
                    {plan.popular && subscription?.plan_id !== plan.id && <Badge variant="secondary">Popular</Badge>}
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

          {currentPlan && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-6 border-border/50 bg-card/50">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Team Members</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage who has access to your organization
                  </p>
                </div>
                <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Users className="w-4 h-4 mr-2" />
                      Invite Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invite Team Member</DialogTitle>
                      <DialogDescription>
                        Send an invitation to join your organization
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="inviteEmail">Email Address</Label>
                        <Input
                          id="inviteEmail"
                          type="email"
                          placeholder="colleague@company.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="inviteRole">Role</Label>
                        <Select value={inviteRole} onValueChange={setInviteRole}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setInviteOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleInvite} disabled={!inviteEmail || inviting}>
                        {inviting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Send Invitation
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

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
                  <Badge variant="secondary" className="bg-chart-2/20 text-chart-2">active</Badge>
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-6 border-border/50 bg-card/50">
              <h3 className="text-lg font-semibold text-foreground mb-6">Organization Details</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input 
                    id="orgName"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgSlug">Organization URL</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">digit.app/</span>
                    <Input 
                      id="orgSlug"
                      value={orgSlug}
                      onChange={(e) => setOrgSlug(e.target.value)}
                      className="bg-secondary/50"
                    />
                  </div>
                </div>
              </div>
              <Button className="mt-6" onClick={handleSaveOrg} disabled={savingOrg || !orgName}>
                {savingOrg ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Changes
              </Button>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="p-6 border-border/50 bg-card/50">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">API Keys</h3>
                  <p className="text-sm text-muted-foreground">Manage your API access keys for integrations</p>
                </div>
                <Button onClick={handleGenerateKey} disabled={generatingKey}>
                  {generatingKey ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Key className="w-4 h-4 mr-2" />
                  )}
                  Generate Key
                </Button>
              </div>

              {generatedKey && (
                <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <p className="text-sm font-medium text-amber-600">Your new API key</p>
                  </div>
                  <p className="text-xs text-amber-600/80 mb-3">
                    Copy this key now. You won&apos;t be able to see it again.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 rounded bg-background text-sm font-mono break-all">
                      {showKey ? generatedKey : `${generatedKey.substring(0, 12)}${'•'.repeat(20)}`}
                    </code>
                    <Button size="icon" variant="outline" onClick={() => setShowKey(!showKey)}>
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button size="icon" variant="outline" onClick={handleCopyKey}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setGeneratedKey(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {apiKeys.length === 0 && !apiKeysLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No API keys created yet</p>
                  <p className="text-sm mt-2">Generate an API key to integrate DigiT with your systems</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {apiKeys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                      <div>
                        <p className="text-sm font-medium text-foreground">{key.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{key.key_prefix}...</p>
                        <p className="text-xs text-muted-foreground">
                          Created {new Date(key.created_at).toLocaleDateString()}
                          {key.last_used_at && ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteKey(key.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
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
                  {twoFactorAuth ? (
                    <Dialog open={twoFADisableOpen} onOpenChange={setTwoFADisableOpen}>
                      <DialogTrigger asChild>
                        <Switch checked={twoFactorAuth} />
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
                          <DialogDescription>
                            Enter a TOTP code from your authenticator app to confirm
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                          <Input
                            placeholder="000000"
                            value={twoFADisableCode}
                            onChange={(e) => setTwoFADisableCode(e.target.value)}
                            maxLength={6}
                            className="text-center text-2xl tracking-widest"
                          />
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setTwoFADisableOpen(false)}>Cancel</Button>
                          <Button variant="destructive" onClick={handle2FADisable} disabled={!twoFADisableCode || verifying2FA}>
                            {verifying2FA ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Disable
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <Dialog open={twoFASetupOpen} onOpenChange={(open) => { setTwoFASetupOpen(open); if (!open) { setQrCode(null); setBackupCodes([]); setTwoFASetupCode(""); } }}>
                      <DialogTrigger asChild>
                        <Switch checked={twoFactorAuth} onCheckedChange={(checked) => { if (checked) handle2FASetup() }} />
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
                          <DialogDescription>
                            Scan the QR code with your authenticator app
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-6">
                          {qrCode && (
                            <div className="flex justify-center">
                              <Image src={qrCode} alt="2FA QR Code" width={200} height={200} className="rounded-lg" />
                            </div>
                          )}
                          <div className="space-y-2">
                            <Label htmlFor="twoFACode">Verify with TOTP code</Label>
                            <Input
                              id="twoFACode"
                              placeholder="000000"
                              value={twoFASetupCode}
                              onChange={(e) => setTwoFASetupCode(e.target.value)}
                              maxLength={6}
                              className="text-center text-2xl tracking-widest"
                            />
                          </div>
                          {backupCodes.length > 0 && (
                            <div className="p-4 rounded-lg bg-muted/50">
                              <p className="text-sm font-medium mb-2">Backup Codes</p>
                              <p className="text-xs text-muted-foreground mb-3">Save these in a secure place. Each code can only be used once.</p>
                              <div className="grid grid-cols-2 gap-2">
                                {backupCodes.map((code, i) => (
                                  <code key={i} className="text-xs font-mono bg-background p-1 rounded text-center">{code}</code>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => { setTwoFASetupOpen(false); setQrCode(null); setBackupCodes([]); setTwoFASetupCode(""); }}>
                            Cancel
                          </Button>
                          <Button onClick={handle2FAVerify} disabled={!twoFASetupCode || verifying2FA}>
                            {verifying2FA ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Verify & Enable
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
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
                  <Switch 
                    checked={emailNotifications} 
                    onCheckedChange={async (checked) => {
                      setEmailNotifications(checked)
                      try {
                        await api("/api/v1/notifications/preferences", {
                          method: "PUT",
                          body: JSON.stringify({ category: "security", channel: "email", enabled: checked }),
                        })
                      } catch { /* silent */ }
                    }} 
                  />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="p-6 border-border/50 bg-card/50">
              <h3 className="text-lg font-semibold text-foreground mb-6">Change Password</h3>
              <div className="space-y-4 max-w-md">
                {passwordError && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    {passwordError}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input 
                    id="currentPassword" 
                    type="password" 
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="bg-secondary/50" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input 
                    id="newPassword" 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-secondary/50" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input 
                    id="confirmPassword" 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-secondary/50" 
                  />
                </div>
                <Button onClick={handleChangePassword} disabled={changingPassword}>
                  {changingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Update Password
                </Button>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="p-6 border-destructive/20 bg-destructive/5">
              <h3 className="text-lg font-semibold text-destructive mb-2">Danger Zone</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Once you delete your account, there is no going back. Please be certain.
              </p>
              <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive">Delete Account</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Account</DialogTitle>
                    <DialogDescription>
                      This will permanently delete your account and all associated data.
                      Type <strong>DELETE</strong> to confirm.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Input
                      placeholder="Type DELETE to confirm"
                      value={deleteConfirm}
                      onChange={(e) => setDeleteConfirm(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleDeleteAccount} 
                      disabled={deleteConfirm !== "DELETE" || deleting}
                    >
                      {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Delete My Account
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
