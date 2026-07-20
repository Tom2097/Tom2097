"use client"

import { useEffect, useState, useTransition, useCallback, Suspense } from "react"
import { motion } from "framer-motion"
import {
  CreditCard,
  Users,
  Building2,
  Shield,
  Key,
  Fingerprint,
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
import { startRegistration } from "@simplewebauthn/browser"
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
import { UsageMonitor } from "@/components/digit/usage-monitor"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useI18n } from "@/components/providers/i18n-provider"

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

function SuccessBanner({ t }: { t: (key: string, params?: Record<string, string | number>) => string }) {
  const searchParams = useSearchParams()
  const success = searchParams?.get("success")
  
  if (!success) return null
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600"
    >
      <Check className="w-5 h-5" />
      <span>{t("settings.successBanner")}</span>
    </motion.div>
  )
}

export default function SettingsPage() {
  const { t } = useI18n();
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

  // Passkey state
  const [passkeys, setPasskeys] = useState<{ id: string; device_name: string; created_at: string; last_used_at: string | null }[]>([])
  const [passkeysLoading, setPasskeysLoading] = useState(false)
  const [registeringPasskey, setRegisteringPasskey] = useState(false)
  const [passkeySupported, setPasskeySupported] = useState(false)

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

  // API keys handlers
  const fetchApiKeys = useCallback(async () => {
    setApiKeysLoading(true)
    try {
      const data = await api("/api/v1/api-keys")
      setApiKeys(data.keys)
    } catch {
      // silent
    } finally {
      setApiKeysLoading(false)
    }
  }, [api])

  // Passkey handlers
  const fetchPasskeys = useCallback(async () => {
    setPasskeysLoading(true)
    try {
      const data = await api("/api/auth/passkeys")
      setPasskeys(data.passkeys)
    } catch {
      // silent
    } finally {
      setPasskeysLoading(false)
    }
  }, [api])

  const handleRegisterPasskey = async () => {
    setRegisteringPasskey(true)
    try {
      const start = await api("/api/auth/passkeys/register", {
        method: "POST",
        body: JSON.stringify({ action: "start-registration" }),
      })
      const credential = await startRegistration({ optionsJSON: start.options })
      const deviceName =
        typeof navigator !== "undefined" && /iphone|ipad/i.test(navigator.userAgent)
          ? "iPhone/iPad"
          : typeof navigator !== "undefined" && /android/i.test(navigator.userAgent)
            ? "Android device"
            : typeof navigator !== "undefined" && /mac/i.test(navigator.userAgent)
              ? "Mac"
              : typeof navigator !== "undefined" && /win/i.test(navigator.userAgent)
                ? "Windows PC"
                : "This device"
      await api("/api/auth/passkeys/register", {
        method: "POST",
        body: JSON.stringify({ action: "verify-registration", data: { credential, deviceName } }),
      })
      showToast("success", t("settings.security.passkeys.registerSuccess"))
      fetchPasskeys()
    } catch (err: any) {
      if (err?.name !== "NotAllowedError") {
        showToast("error", err?.message || t("settings.security.passkeys.registerFailed"))
      }
    } finally {
      setRegisteringPasskey(false)
    }
  }

  const handleDeletePasskey = async (id: string) => {
    try {
      await api(`/api/auth/passkeys?id=${id}`, { method: "DELETE" })
      setPasskeys((prev) => prev.filter((p) => p.id !== id))
      showToast("success", t("settings.security.passkeys.removeSuccess"))
    } catch (err: any) {
      showToast("error", err?.message || t("settings.security.passkeys.removeFailed"))
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined" && window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()
        .then(setPasskeySupported)
        .catch(() => setPasskeySupported(false))
    }
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

    const fetchNotificationPreferences = async () => {
      try {
        const data = await api("/api/v1/notifications/preferences")
        const preferences = (data.preferences ?? []) as { category: string; channel: string; enabled: boolean }[]
        const emailPref = preferences.find((p) => p.category === "security" && p.channel === "email")
        // Opt-out model: absence of a row means the channel is enabled.
        setEmailNotifications(emailPref ? emailPref.enabled : true)
      } catch {
        // silent -- keep the default (enabled)
      }
    }

    // API keys previously only loaded after generating a new one -- visiting
    // the Organization tab and seeing existing keys never worked because
    // fetchApiKeys() was never called on mount.
    const loadApiKeys = async () => {
      await fetchApiKeys()
    }

    const loadPasskeys = async () => {
      await fetchPasskeys()
    }

    fetchData()
    loadApiKeys()
    loadPasskeys()
    fetchNotificationPreferences()
  }, [fetchApiKeys, fetchPasskeys])

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
        <h1 className="text-3xl font-bold text-foreground mb-2">{t("settings.title")}</h1>
        <p className="text-muted-foreground">{t("settings.description")}</p>
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
        <SuccessBanner t={t} />
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
                      {t("settings.subscription.plan", { planName: currentPlan?.name || t("settings.subscription.status.trialing") })}
                    </h2>
                    <Badge 
                      variant="secondary" 
                      className={subscription?.status === "active" 
                        ? "bg-chart-2/20 text-chart-2 border-chart-2/30"
                        : "bg-amber-500/20 text-amber-600 border-amber-500/30"
                      }
                    >
                      {t(`settings.subscription.status.${subscription?.status || "trialing"}`)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {currentPlan 
                      ? t("settings.subscription.price", { price: formatPrice(currentPlan.priceInCents) })
                      : t("settings.subscription.trialPeriod")
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
                  <p className="text-sm font-medium text-muted-foreground mb-3">{t("settings.subscription.planFeatures")}</p>
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
                        {t("settings.subscription.nextBillingDate", { date: new Date(subscription.current_period_end).toLocaleDateString() })}
                      </p>
                      {subscription.cancel_at_period_end && (
                        <div className="flex items-center gap-2 text-amber-600 text-sm">
                          <AlertCircle className="w-4 h-4" />
                          {t("settings.subscription.cancelAtPeriodEnd")}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t("settings.subscription.trialNoBilling")}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h3 className="text-lg font-semibold mb-4">{t("settings.subscription.availablePlans")}</h3>
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
                    {subscription?.plan_id === plan.id && <Badge>{t("settings.subscription.current")}</Badge>}
                    {plan.popular && subscription?.plan_id !== plan.id && <Badge variant="secondary">{t("settings.subscription.popular")}</Badge>}
                  </div>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-2xl font-bold">{formatPrice(plan.priceInCents)}</span>
                    <span className="text-muted-foreground text-sm">{t("settings.subscription.month")}</span>
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
                        {!subscription?.plan_id ? t("settings.subscription.startTrial") : t("settings.subscription.upgrade")}
                      </Link>
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          </motion.div>

          {currentPlan && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h3 className="text-lg font-semibold mb-4">{t("settings.subscription.usageLimits")}</h3>
              <UsageMonitor
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
                  <h3 className="text-lg font-semibold text-foreground">{t("settings.team.title")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.team.description")}
                  </p>
                </div>
                <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Users className="w-4 h-4 mr-2" />
                      {t("settings.team.inviteMember")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("settings.team.inviteDialog.title")}</DialogTitle>
                      <DialogDescription>
                        {t("settings.team.inviteDialog.description")}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="inviteEmail">{t("settings.team.inviteDialog.emailLabel")}</Label>
                        <Input
                          id="inviteEmail"
                          type="email"
                          placeholder={t("settings.team.inviteDialog.emailPlaceholder")}
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="inviteRole">{t("settings.team.inviteDialog.roleLabel")}</Label>
                        <Select value={inviteRole} onValueChange={setInviteRole}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">{t("settings.team.inviteDialog.roleOptions.member")}</SelectItem>
                            <SelectItem value="admin">{t("settings.team.inviteDialog.roleOptions.admin")}</SelectItem>
                            <SelectItem value="viewer">{t("settings.team.inviteDialog.roleOptions.viewer")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setInviteOpen(false)}>
                        {t("settings.team.inviteDialog.cancel")}
                      </Button>
                      <Button onClick={handleInvite} disabled={!inviteEmail || inviting}>
                        {inviting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {t("settings.team.inviteDialog.sendInvitation")}
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
                  <Badge variant="secondary" className="bg-chart-2/20 text-chart-2">{t("settings.team.status.active")}</Badge>
                  <Badge>{profile?.role || t("settings.team.status.owner")}</Badge>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mt-4">
                {t("settings.team.inviteDescription")}
              </p>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Organization Tab */}
        <TabsContent value="organization" className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-6 border-border/50 bg-card/50">
              <h3 className="text-lg font-semibold text-foreground mb-6">{t("settings.organization.details")}</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="orgName">{t("settings.organization.nameLabel")}</Label>
                  <Input 
                    id="orgName"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgSlug">{t("settings.organization.urlLabel")}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">{t("settings.organization.urlPrefix")}</span>
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
                {t("settings.organization.saveChanges")}
              </Button>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="p-6 border-border/50 bg-card/50">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{t("settings.organization.apiKeys.title")}</h3>
                  <p className="text-sm text-muted-foreground">{t("settings.organization.apiKeys.description")}</p>
                </div>
                <Button onClick={handleGenerateKey} disabled={generatingKey}>
                  {generatingKey ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Key className="w-4 h-4 mr-2" />
                  )}
                  {t("settings.organization.apiKeys.generateKey")}
                </Button>
              </div>

              {generatedKey && (
                <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <p className="text-sm font-medium text-amber-600">{t("settings.organization.apiKeys.newKey")}</p>
                  </div>
                  <p className="text-xs text-amber-600/80 mb-3">
                    {t("settings.organization.apiKeys.copyKeyWarning")}
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
                  <p>{t("settings.organization.apiKeys.noKeys")}</p>
                  <p className="text-sm mt-2">{t("settings.organization.apiKeys.generateKeyDescription")}</p>
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
              <h3 className="text-lg font-semibold text-foreground mb-6">{t("settings.security.title")}</h3>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{t("settings.security.twoFactorAuth.title")}</p>
                      <p className="text-xs text-muted-foreground">{t("settings.security.twoFactorAuth.description")}</p>
                    </div>
                  </div>
                  {twoFactorAuth ? (
                    <Dialog open={twoFADisableOpen} onOpenChange={setTwoFADisableOpen}>
                      <DialogTrigger asChild>
                        <Switch checked={twoFactorAuth} />
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t("settings.security.twoFactorAuth.disableTitle")}</DialogTitle>
                          <DialogDescription>
                            {t("settings.security.twoFactorAuth.disableDescription")}
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
                          <Button variant="outline" onClick={() => setTwoFADisableOpen(false)}>{t("settings.security.twoFactorAuth.cancel")}</Button>
                          <Button variant="destructive" onClick={handle2FADisable} disabled={!twoFADisableCode || verifying2FA}>
                            {verifying2FA ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            {t("settings.security.twoFactorAuth.disable")}
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
                          <DialogTitle>{t("settings.security.twoFactorAuth.setupTitle")}</DialogTitle>
                          <DialogDescription>
                            {t("settings.security.twoFactorAuth.setupDescription")}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-6">
                          {qrCode && (
                            <div className="flex justify-center">
                              <Image src={qrCode} alt="2FA QR Code" width={200} height={200} className="rounded-lg" />
                            </div>
                          )}
                          <div className="space-y-2">
                            <Label htmlFor="twoFACode">{t("settings.security.twoFactorAuth.verifyCodeLabel")}</Label>
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
                              <p className="text-sm font-medium mb-2">{t("settings.security.twoFactorAuth.backupCodes.title")}</p>
                              <p className="text-xs text-muted-foreground mb-3">{t("settings.security.twoFactorAuth.backupCodes.description")}</p>
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
                            {t("settings.security.twoFactorAuth.cancel")}
                          </Button>
                          <Button onClick={handle2FAVerify} disabled={!twoFASetupCode || verifying2FA}>
                            {verifying2FA ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            {t("settings.security.twoFactorAuth.verifyEnable")}
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
                      <p className="text-sm font-medium text-foreground">{t("settings.security.emailNotifications.title")}</p>
                      <p className="text-xs text-muted-foreground">{t("settings.security.emailNotifications.description")}</p>
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

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="p-6 border-border/50 bg-card/50">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{t("settings.security.passkeys.title")}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{t("settings.security.passkeys.description")}</p>
                </div>
                <Button onClick={handleRegisterPasskey} disabled={registeringPasskey || !passkeySupported} size="sm" className="gap-2">
                  {registeringPasskey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
                  {t("settings.security.passkeys.register")}
                </Button>
              </div>

              {!passkeySupported && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {t("settings.security.passkeys.unsupported")}
                </div>
              )}

              {passkeysLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : passkeys.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">{t("settings.security.passkeys.empty")}</p>
              ) : (
                <div className="space-y-2">
                  {passkeys.map((passkey) => (
                    <div key={passkey.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                          <Fingerprint className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{passkey.device_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {t("settings.security.passkeys.added")} {new Date(passkey.created_at).toLocaleDateString()}
                            {passkey.last_used_at && ` · ${t("settings.security.passkeys.lastUsed")} ${new Date(passkey.last_used_at).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeletePasskey(passkey.id)}>
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="p-6 border-border/50 bg-card/50">
              <h3 className="text-lg font-semibold text-foreground mb-6">{t("settings.security.changePassword.title")}</h3>
              <div className="space-y-4 max-w-md">
                {passwordError && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    {passwordError}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">{t("settings.security.changePassword.currentPassword")}</Label>
                  <Input 
                    id="currentPassword" 
                    type="password" 
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="bg-secondary/50" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">{t("settings.security.changePassword.newPassword")}</Label>
                  <Input 
                    id="newPassword" 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-secondary/50" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t("settings.security.changePassword.confirmPassword")}</Label>
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
                  {t("settings.security.changePassword.updatePassword")}
                </Button>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="p-6 border-destructive/20 bg-destructive/5">
              <h3 className="text-lg font-semibold text-destructive mb-2">{t("settings.security.dangerZone.title")}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("settings.security.dangerZone.description")}
              </p>
              <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive">{t("settings.security.dangerZone.deleteAccount")}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("settings.security.dangerZone.deleteDialog.title")}</DialogTitle>
                    <DialogDescription>
                      {t("settings.security.dangerZone.deleteDialog.description", { confirmation: "DELETE" })}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Input
                      placeholder={t("settings.security.dangerZone.deleteDialog.confirmationPlaceholder")}
                      value={deleteConfirm}
                      onChange={(e) => setDeleteConfirm(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDeleteOpen(false)}>{t("settings.security.dangerZone.deleteDialog.cancel")}</Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleDeleteAccount} 
                      disabled={deleteConfirm !== "DELETE" || deleting}
                    >
                      {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      {t("settings.security.dangerZone.deleteDialog.deleteAccount")}
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
