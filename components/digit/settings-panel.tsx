"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Settings,
  X,
  User,
  Bell,
  Palette,
  Globe,
  Shield,
  Monitor,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Languages,
  Clock,
  Keyboard,
  Accessibility,
  ChevronRight,
  Check,
  LogOut,
  CreditCard,
  Building2,
  ExternalLink,
  Sparkles
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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

interface UserProfile {
  full_name: string | null
  email: string
  avatar_url: string | null
}

// Settings configuration
const themes = [
  { id: "dark", label: "Dark", icon: Moon },
  { id: "light", label: "Light", icon: Sun },
  { id: "system", label: "System", icon: Monitor },
]

const languages = [
  { id: "en", label: "English" },
  { id: "es", label: "Spanish" },
  { id: "fr", label: "French" },
  { id: "de", label: "German" },
  { id: "ja", label: "Japanese" },
  { id: "zh", label: "Chinese" },
]

const timezones = [
  { id: "UTC", label: "UTC (Coordinated Universal Time)" },
  { id: "America/New_York", label: "Eastern Time (ET)" },
  { id: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { id: "Europe/London", label: "London (GMT)" },
  { id: "Europe/Paris", label: "Paris (CET)" },
  { id: "Asia/Tokyo", label: "Tokyo (JST)" },
]

const keyboardShortcuts = [
  { action: "Open AI Assistant", keys: ["Ctrl", "K"] },
  { action: "Quick Search", keys: ["Ctrl", "/"] },
  { action: "Toggle Sidebar", keys: ["Ctrl", "B"] },
  { action: "Open Settings", keys: ["Ctrl", ","] },
  { action: "Navigate Home", keys: ["G", "H"] },
  { action: "Open Analytics", keys: ["G", "A"] },
]

export function SettingsPanel() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("profile")
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  
  // Settings state
  const [settings, setSettings] = useState({
    // Appearance
    theme: "dark",
    accentColor: "cyan",
    compactMode: false,
    animationsEnabled: true,
    
    // Notifications
    emailNotifications: true,
    pushNotifications: true,
    soundEnabled: true,
    desktopAlerts: true,
    weeklyDigest: true,
    
    // Privacy
    analyticsEnabled: true,
    showOnlineStatus: true,
    shareUsageData: false,
    
    // Accessibility
    reducedMotion: false,
    highContrast: false,
    fontSize: 100,
    
    // Regional
    language: "en",
    timezone: "UTC",
    dateFormat: "MM/DD/YYYY",
    
    // AI
    aiSuggestions: true,
    autoAnalysis: true,
    voiceCommands: false,
  })

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
    router.push("/auth/login")
  }

  const updateSetting = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
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
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="grid grid-cols-5 mx-4 mt-4 bg-muted/50">
                  <TabsTrigger value="profile" className="text-xs px-2">
                    <User className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="appearance" className="text-xs px-2">
                    <Palette className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="notifications" className="text-xs px-2">
                    <Bell className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="accessibility" className="text-xs px-2">
                    <Accessibility className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="shortcuts" className="text-xs px-2">
                    <Keyboard className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-y-auto p-4">
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
                            <p className="text-xs text-muted-foreground">Password & 2FA</p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-border">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Regional</h3>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Languages className="h-5 w-5 text-muted-foreground" />
                            <Label>Language</Label>
                          </div>
                          <Select value={settings.language} onValueChange={(v) => updateSetting("language", v)}>
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {languages.map(lang => (
                                <SelectItem key={lang.id} value={lang.id}>{lang.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            <Label>Timezone</Label>
                          </div>
                          <Select value={settings.timezone} onValueChange={(v) => updateSetting("timezone", v)}>
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {timezones.map(tz => (
                                <SelectItem key={tz.id} value={tz.id}>{tz.id}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
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
                        {themes.map(theme => (
                          <button
                            key={theme.id}
                            onClick={() => updateSetting("theme", theme.id)}
                            className={cn(
                              "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
                              settings.theme === theme.id
                                ? "border-primary bg-primary/10"
                                : "border-border bg-muted/30 hover:bg-muted/50"
                            )}
                          >
                            <theme.icon className={cn(
                              "h-5 w-5",
                              settings.theme === theme.id ? "text-primary" : "text-muted-foreground"
                            )} />
                            <span className="text-xs font-medium">{theme.label}</span>
                            {settings.theme === theme.id && (
                              <Check className="h-3 w-3 text-primary absolute top-2 right-2" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Accent Color</h3>
                      <div className="flex gap-2">
                        {["cyan", "blue", "purple", "pink", "orange", "green"].map(color => (
                          <button
                            key={color}
                            onClick={() => updateSetting("accentColor", color)}
                            className={cn(
                              "w-8 h-8 rounded-full border-2 transition-transform",
                              settings.accentColor === color ? "scale-110 border-white" : "border-transparent",
                              color === "cyan" && "bg-cyan-500",
                              color === "blue" && "bg-blue-500",
                              color === "purple" && "bg-purple-500",
                              color === "pink" && "bg-pink-500",
                              color === "orange" && "bg-orange-500",
                              color === "green" && "bg-green-500"
                            )}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Display</h3>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Compact Mode</Label>
                          <p className="text-xs text-muted-foreground">Reduce spacing and padding</p>
                        </div>
                        <Switch 
                          checked={settings.compactMode} 
                          onCheckedChange={(v) => updateSetting("compactMode", v)} 
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Animations</Label>
                          <p className="text-xs text-muted-foreground">Enable UI animations</p>
                        </div>
                        <Switch 
                          checked={settings.animationsEnabled} 
                          onCheckedChange={(v) => updateSetting("animationsEnabled", v)} 
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Notifications Tab */}
                  <TabsContent value="notifications" className="mt-0 space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Channels</h3>
                      
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <Bell className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <Label>Email Notifications</Label>
                            <p className="text-xs text-muted-foreground">Important updates via email</p>
                          </div>
                        </div>
                        <Switch 
                          checked={settings.emailNotifications} 
                          onCheckedChange={(v) => updateSetting("emailNotifications", v)} 
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <Monitor className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <Label>Desktop Alerts</Label>
                            <p className="text-xs text-muted-foreground">Browser notifications</p>
                          </div>
                        </div>
                        <Switch 
                          checked={settings.desktopAlerts} 
                          onCheckedChange={(v) => updateSetting("desktopAlerts", v)} 
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          {settings.soundEnabled ? (
                            <Volume2 className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <VolumeX className="h-5 w-5 text-muted-foreground" />
                          )}
                          <div>
                            <Label>Sound Effects</Label>
                            <p className="text-xs text-muted-foreground">Play sounds for alerts</p>
                          </div>
                        </div>
                        <Switch 
                          checked={settings.soundEnabled} 
                          onCheckedChange={(v) => updateSetting("soundEnabled", v)} 
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">AI Features</h3>
                      
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <Sparkles className="h-5 w-5 text-primary" />
                          <div>
                            <Label>AI Suggestions</Label>
                            <p className="text-xs text-muted-foreground">Proactive AI recommendations</p>
                          </div>
                        </div>
                        <Switch 
                          checked={settings.aiSuggestions} 
                          onCheckedChange={(v) => updateSetting("aiSuggestions", v)} 
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <Sparkles className="h-5 w-5 text-cyan-500" />
                          <div>
                            <Label>Auto Analysis</Label>
                            <p className="text-xs text-muted-foreground">Automatic data insights</p>
                          </div>
                        </div>
                        <Switch 
                          checked={settings.autoAnalysis} 
                          onCheckedChange={(v) => updateSetting("autoAnalysis", v)} 
                        />
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
                          <span className="text-sm text-muted-foreground">{settings.fontSize}%</span>
                        </div>
                        <Slider
                          value={[settings.fontSize]}
                          onValueChange={([v]) => updateSetting("fontSize", v)}
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
                          checked={settings.highContrast} 
                          onCheckedChange={(v) => updateSetting("highContrast", v)} 
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
                          checked={settings.reducedMotion} 
                          onCheckedChange={(v) => updateSetting("reducedMotion", v)} 
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Privacy</h3>
                      
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          {settings.showOnlineStatus ? (
                            <Eye className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <EyeOff className="h-5 w-5 text-muted-foreground" />
                          )}
                          <div>
                            <Label>Online Status</Label>
                            <p className="text-xs text-muted-foreground">Show when you&apos;re active</p>
                          </div>
                        </div>
                        <Switch 
                          checked={settings.showOnlineStatus} 
                          onCheckedChange={(v) => updateSetting("showOnlineStatus", v)} 
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Shortcuts Tab */}
                  <TabsContent value="shortcuts" className="mt-0 space-y-4">
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Keyboard Shortcuts</h3>
                      
                      <div className="space-y-2">
                        {keyboardShortcuts.map((shortcut, idx) => (
                          <div 
                            key={idx}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                          >
                            <span className="text-sm">{shortcut.action}</span>
                            <div className="flex gap-1">
                              {shortcut.keys.map((key, kidx) => (
                                <Badge key={kidx} variant="secondary" className="font-mono text-xs">
                                  {key}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-sm text-center">
                        Press <Badge variant="secondary" className="font-mono mx-1">?</Badge> anywhere to view all shortcuts
                      </p>
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
