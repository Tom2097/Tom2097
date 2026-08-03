"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "next-themes"
import {
  Settings,
  X,
  User,
  Palette,
  Shield,
  Monitor,
  Moon,
  Sun,
  Eye,
  Accessibility,
  ChevronRight,
  Check,
  LogOut,
  CreditCard,
  Building2,
  ExternalLink,
  Sparkles,
  Globe,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useI18n } from "@/components/providers/i18n-provider"
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config"
import {
  ACCENT_PRESETS,
  applyAppearancePrefs,
  loadAppearancePrefs,
  updateAppearancePref,
  type AccentName,
  type AppearancePrefs,
} from "@/lib/preferences/appearance"

interface UserProfile {
  full_name: string | null
  email: string
  avatar_url: string | null
}

const themes = [
  { id: "dark", label: "Dark", icon: Moon },
  { id: "light", label: "Light", icon: Sun },
  { id: "system", label: "System", icon: Monitor },
]

const accentSwatchClass: Record<AccentName, string> = {
  cyan: "bg-cyan-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  orange: "bg-orange-500",
  green: "bg-green-500",
}

export function SettingsPanel() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { locale, setLocale } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("profile")
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [prefs, setPrefs] = useState<AppearancePrefs>(loadAppearancePrefs)

  // Apply whatever was saved from a previous session as soon as this
  // (globally-mounted) component is available, not just while the panel is
  // open -- so the effect holds across the whole app, not just this dialog.
  useEffect(() => {
    applyAppearancePrefs(prefs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setPref = <K extends keyof AppearancePrefs>(key: K, value: AppearancePrefs[K]) => {
    setPrefs((current) => updateAppearancePref(current, key, value))
  }

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("full_name, email, avatar_url")
          .eq("id", user.id)
          .single()
        if (data) {
          setProfile(data)
        }
      }
    }
    if (isOpen) {
      fetchProfile()
    }
  }, [isOpen])

  const handleSignOut = async () => {
    setIsSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <>
      {/* Settings Trigger Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-24 right-6 z-40",
          "flex items-center gap-2 px-4 py-2.5 rounded-full",
          "bg-muted/80 backdrop-blur-sm border border-border/50",
          "text-sm font-medium text-muted-foreground",
          "shadow-lg hover:bg-muted hover:text-foreground",
          "transition-colors"
        )}
      >
        <Settings className="h-4 w-4" />
        <span>Settings</span>
      </motion.button>

      {/* Settings Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, x: 400 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 400 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={cn(
                "fixed right-0 top-0 bottom-0 z-50",
                "w-full max-w-md",
                "bg-card border-l border-border",
                "shadow-2xl flex flex-col"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Settings className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Settings</h2>
                    <p className="text-xs text-muted-foreground">Customize your experience</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* User Profile Card */}
              {profile ? (
                <div className="p-4 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center text-white font-semibold">
                      {profile.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{profile.full_name || 'User'}</p>
                      <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/settings">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Full Settings
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 border-b border-border bg-muted/30">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-3">Sign in to access all settings</p>
                    <div className="flex gap-2 justify-center">
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/auth/login">Sign In</Link>
                      </Button>
                      <Button size="sm" asChild>
                        <Link href="/auth/sign-up">Get Started</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <TabsList className="grid grid-cols-3 mx-4 mt-4 bg-muted/50">
                  <TabsTrigger value="profile" className="text-xs px-2 gap-1.5">
                    <User className="h-4 w-4" />
                    Profile
                  </TabsTrigger>
                  <TabsTrigger value="appearance" className="text-xs px-2 gap-1.5">
                    <Palette className="h-4 w-4" />
                    Appearance
                  </TabsTrigger>
                  <TabsTrigger value="accessibility" className="text-xs px-2 gap-1.5">
                    <Accessibility className="h-4 w-4" />
                    Accessibility
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 min-h-0 overflow-y-auto p-4">
                  {/* Profile Tab */}
                  <TabsContent value="profile" className="mt-0 space-y-4">
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Account</h3>

                      <Link href="/settings?tab=subscription" className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <CreditCard className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Subscription</p>
                            <p className="text-xs text-muted-foreground">Manage your plan</p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>

                      <Link href="/settings?tab=organization" className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Organization</p>
                            <p className="text-xs text-muted-foreground">Team settings</p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>

                      <Link href="/settings?tab=security" className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Shield className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Security</p>
                            <p className="text-xs text-muted-foreground">Password, 2FA & notifications</p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-border">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Regional</h3>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Globe className="h-5 w-5 text-muted-foreground" />
                          <Label>Language</Label>
                        </div>
                        <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SUPPORTED_LOCALES.map((loc) => (
                              <SelectItem key={loc} value={loc}>
                                {`${LOCALE_LABELS[loc].flag} ${LOCALE_LABELS[loc].nativeName}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border">
                      {profile ? (
                        <Button
                          variant="destructive"
                          className="w-full"
                          onClick={handleSignOut}
                          disabled={isSigningOut}
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          {isSigningOut ? "Signing out..." : "Sign Out"}
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <Button className="w-full" asChild>
                            <Link href="/auth/sign-up">
                              <Sparkles className="h-4 w-4 mr-2" />
                              Get Started
                            </Link>
                          </Button>
                          <Button variant="outline" className="w-full" asChild>
                            <Link href="/auth/login">Sign In</Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Appearance Tab */}
                  <TabsContent value="appearance" className="mt-0 space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Theme</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {themes.map((th) => (
                          <button
                            key={th.id}
                            onClick={() => setTheme(th.id)}
                            className={cn(
                              "relative flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
                              theme === th.id
                                ? "border-primary bg-primary/10"
                                : "border-border bg-muted/30 hover:bg-muted/50"
                            )}
                          >
                            <th.icon className={cn(
                              "h-5 w-5",
                              theme === th.id ? "text-primary" : "text-muted-foreground"
                            )} />
                            <span className="text-xs font-medium">{th.label}</span>
                            {theme === th.id && (
                              <Check className="h-3 w-3 text-primary absolute top-2 right-2" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Accent Color</h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPref("accentColor", "default")}
                          title="Default"
                          className={cn(
                            "w-8 h-8 rounded-full border-2 transition-transform bg-primary",
                            prefs.accentColor === "default" ? "scale-110 border-foreground" : "border-transparent"
                          )}
                        />
                        {(Object.keys(ACCENT_PRESETS) as AccentName[]).map((name) => (
                          <button
                            key={name}
                            onClick={() => setPref("accentColor", name)}
                            title={ACCENT_PRESETS[name].label}
                            className={cn(
                              "w-8 h-8 rounded-full border-2 transition-transform",
                              accentSwatchClass[name],
                              prefs.accentColor === name ? "scale-110 border-foreground" : "border-transparent"
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Accessibility Tab */}
                  <TabsContent value="accessibility" className="mt-0 space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Visual</h3>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Font Size</Label>
                          <span className="text-sm text-muted-foreground">{prefs.fontSize}%</span>
                        </div>
                        <Slider
                          value={[prefs.fontSize]}
                          onValueChange={([v]) => setPref("fontSize", v)}
                          min={80}
                          max={120}
                          step={10}
                          className="w-full"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <Eye className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <Label>High Contrast</Label>
                            <p className="text-xs text-muted-foreground">Increase color contrast</p>
                          </div>
                        </div>
                        <Switch
                          checked={prefs.highContrast}
                          onCheckedChange={(v) => setPref("highContrast", v)}
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <Accessibility className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <Label>Reduced Motion</Label>
                            <p className="text-xs text-muted-foreground">Minimize animations</p>
                          </div>
                        </div>
                        <Switch
                          checked={prefs.reducedMotion}
                          onCheckedChange={(v) => setPref("reducedMotion", v)}
                        />
                      </div>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
