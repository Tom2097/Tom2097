'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import {
  Bell,
  Search,
  MessageSquare,
  User,
  LogOut,
  Settings,
  BarChart3,
  Users,
  LayoutGrid,
  Activity,
  Boxes,
  ShieldCheck,
  FileText,
  Sparkles,
  Clock,
  ArrowRight,
  Command,
  LayoutDashboard,
  CheckCheck,
  BellOff,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LanguageSwitcher } from '@/components/language-switcher'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { Notification } from '@/lib/notifications/types'
import { useI18n } from '@/components/providers/i18n-provider'

// Search items database
const searchItems = [
  // Modules
  { type: 'module', title: 'AI Analytics', description: 'Enterprise intelligence and predictive analytics', icon: BarChart3, href: '/analytics', category: 'Modules' },
  { type: 'module', title: 'Smart CRM', description: 'Customer management and sales automation', icon: Users, href: '/crm', category: 'Modules' },
  { type: 'module', title: 'Operations Workspace', description: 'Process monitoring and workflow optimization', icon: LayoutGrid, href: '/operations', category: 'Modules' },
  { type: 'module', title: 'Performance Workspace', description: 'Anomaly detection and trend analysis', icon: Activity, href: '/performance', category: 'Modules' },
  { type: 'module', title: 'Resource Workspace', description: 'Capacity planning and inventory intelligence', icon: Boxes, href: '/resources', category: 'Modules' },
  { type: 'module', title: 'Compliance Workspace', description: 'Audit readiness and quality control', icon: ShieldCheck, href: '/compliance', category: 'Modules' },
   // Pages
   { type: 'page', title: 'Dashboard', description: 'Overview and key metrics', icon: LayoutDashboard, href: '/', category: 'Pages' },
   { type: 'page', title: 'Configure Workspace', description: 'Workspace settings and preferences', icon: Settings, href: '/configure', category: 'Pages' },
   { type: 'page', title: 'Pricing', description: 'Plans and subscriptions', icon: FileText, href: '/settings/billing', category: 'Pages' },
  // Features
  { type: 'feature', title: 'Revenue Forecast', description: 'Predictive revenue analysis', icon: BarChart3, href: '/#revenue', category: 'Features' },
  { type: 'feature', title: 'Team Management', description: 'Manage team members and roles', icon: Users, href: '/settings?tab=team', category: 'Features' },
  { type: 'feature', title: 'Data Sources', description: 'Connect and manage data integrations', icon: FileText, href: '/settings?tab=organization', category: 'Features' },
  // Actions
  { type: 'action', title: 'Open AI Assistant', description: 'Get AI-powered help', icon: MessageSquare, href: '#ai-assistant', category: 'Actions' },
  { type: 'action', title: 'Generate Report', description: 'Create analytics report', icon: FileText, href: '/analytics', category: 'Actions' },
]

const recentSearches = [
  'Revenue forecast',
  'Operations workspace',
  'Team settings'
]

interface NavbarProps {
  onOpenAI?: () => void
}

interface Profile {
  full_name: string | null
  email: string
  role: string
}

export function Navbar({ onOpenAI }: NavbarProps) {
  const { t } = useI18n()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifLoaded, setNotifLoaded] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  // Filter search results
  const searchResults = searchQuery.length > 0 
    ? searchItems.filter(item => 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 8)
    : []

  // Group results by category
  const groupedResults = searchResults.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, typeof searchItems>)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)
      
      if (currentUser) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, email, role')
          .eq('id', currentUser.id)
          .single()
        
        if (data) {
          setProfile(data)
        }

        fetch('/api/notifications/unread-count')
          .then(res => res.json())
          .then(data => setUnreadCount(data.count ?? 0))
          .catch(() => setUnreadCount(0))
      }
      setAuthLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSearchDropdown) return
    
    const flatResults = Object.values(groupedResults).flat()
    
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, flatResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && flatResults[selectedIndex]) {
      e.preventDefault()
      handleSelectItem(flatResults[selectedIndex])
    } else if (e.key === 'Escape') {
      setShowSearchDropdown(false)
      inputRef.current?.blur()
    }
  }

  const handleSelectItem = (item: typeof searchItems[0]) => {
    setShowSearchDropdown(false)
    setSearchQuery('')
    if (item.href === '#ai-assistant' && onOpenAI) {
      onOpenAI()
    } else if (!item.href.startsWith('#')) {
      router.push(item.href)
    }
  }

  const fetchNotifications = async () => {
    setNotifLoading(true)
    try {
      const res = await fetch('/api/v1/notifications?limit=5')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications ?? [])
      }
    } catch {
      // Leave the previously loaded list in place on transient failures.
    } finally {
      setNotifLoading(false)
      setNotifLoaded(true)
    }
  }

  const handleNotificationsOpenChange = (open: boolean) => {
    if (open && !notifLoaded) {
      fetchNotifications()
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    const wasUnread = !notification.read_at
    setNotifications(prev =>
      prev.map(n => (n.id === notification.id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n))
    )
    if (wasUnread) {
      setUnreadCount(prev => Math.max(0, prev - 1))
      fetch(`/api/v1/notifications/${notification.id}`, { method: 'PATCH' }).catch(() => {})
    }
    if (notification.action_url) {
      router.push(notification.action_url)
    }
  }

  const handleMarkAllRead = async (e: Event) => {
    e.preventDefault()
    setNotifications(prev => prev.map(n => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })))
    setUnreadCount(0)
    try {
      await fetch('/api/v1/notifications/read-all', { method: 'POST' })
    } catch {
      // Best-effort; the badge will re-sync next load if this failed.
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 bg-background/80 px-6 backdrop-blur-xl">
      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative" ref={searchRef}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
          <Input 
            ref={inputRef}
            placeholder={t('common.searchPlaceholder')} 
            className="w-80 bg-secondary/50 pl-10 pr-16 text-sm focus:bg-secondary"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowSearchDropdown(e.target.value.length > 0)
              setSelectedIndex(0)
            }}
            onFocus={() => setShowSearchDropdown(true)}
            onKeyDown={handleKeyDown}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
              <Command className="h-3 w-3" />K
            </kbd>
          </div>
          
          {/* Search Dropdown */}
          <AnimatePresence>
            {showSearchDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[420px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
              >
                {searchQuery.length === 0 ? (
                  /* Recent Searches */
                  <div className="p-3">
                    <div className="flex items-center gap-2 px-2 pb-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Recent Searches</span>
                    </div>
                    {recentSearches.map((search, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSearchQuery(search)
                          setShowSearchDropdown(true)
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-left transition-colors hover:bg-muted"
                      >
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <span>{search}</span>
                      </button>
                    ))}
                    <div className="mt-3 border-t border-border pt-3">
                      <div className="flex items-center gap-2 px-2 pb-2">
                        <Sparkles className="h-3.5 w-3.5 text-cyan-500" />
                        <span className="text-xs font-medium text-muted-foreground">Quick Actions</span>
                      </div>
                      <button
                        onClick={() => onOpenAI?.()}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-left transition-colors hover:bg-muted"
                      >
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <span>Open AI Assistant</span>
                        <Badge variant="secondary" className="ml-auto text-xs">Ctrl+K</Badge>
                      </button>
                    </div>
                  </div>
                ) : searchResults.length > 0 ? (
                  /* Search Results */
                  <div className="max-h-[380px] overflow-y-auto">
                    {Object.entries(groupedResults).map(([category, items]) => (
                      <div key={category} className="p-2">
                        <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{category}</p>
                        {items.map((item, idx) => {
                          const flatIndex = Object.values(groupedResults)
                            .flat()
                            .findIndex(i => i.title === item.title)
                          const Icon = item.icon
                          return (
                            <button
                              key={idx}
                              onClick={() => handleSelectItem(item)}
                              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                                flatIndex === selectedIndex 
                                  ? 'bg-primary/10 text-primary' 
                                  : 'hover:bg-muted'
                              }`}
                            >
                              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                                flatIndex === selectedIndex ? 'bg-primary/20' : 'bg-secondary'
                              }`}>
                                <Icon className={`h-4 w-4 ${flatIndex === selectedIndex ? 'text-primary' : 'text-muted-foreground'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{item.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                              </div>
                              <ArrowRight className={`h-4 w-4 shrink-0 ${
                                flatIndex === selectedIndex ? 'text-primary' : 'text-muted-foreground/50'
                              }`} />
                            </button>
                          )
                        })}
                      </div>
                    ))}
                    <div className="border-t border-border p-2">
                      <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
                        <span>Navigate with <kbd className="mx-1 rounded border border-border px-1">↑</kbd><kbd className="rounded border border-border px-1">↓</kbd></span>
                        <span>Select with <kbd className="rounded border border-border px-1.5">Enter</kbd></span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* No Results */
                  <div className="p-6 text-center">
                    <Search className="mx-auto h-10 w-10 text-muted-foreground/30" />
                    <p className="mt-3 text-sm font-medium">No results found</p>
                    <p className="mt-1 text-xs text-muted-foreground">Try searching for modules, pages, or features</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => {
                        setShowSearchDropdown(false)
                        onOpenAI?.()
                      }}
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Ask AI Assistant
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        <LanguageSwitcher />

        {/* AI Assistant Button */}
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
          onClick={onOpenAI}
        >
          <MessageSquare className="h-4 w-4" />
          <span className="hidden sm:inline">AI Assistant</span>
        </Button>

        {/* Notifications */}
        <DropdownMenu onOpenChange={handleNotificationsOpenChange}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              <span className="sr-only">Notifications</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-2 py-1.5">
              <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
              {unreadCount > 0 && (
                <DropdownMenuItem
                  onSelect={handleMarkAllRead}
                  className="w-auto gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground focus:text-foreground"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </DropdownMenuItem>
              )}
            </div>
            <DropdownMenuSeparator />
            {notifLoading ? (
              <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : notifications.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                {notifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    onSelect={() => handleNotificationClick(notification)}
                    className="flex flex-col items-start gap-1 p-3"
                  >
                    <div className="flex w-full items-center gap-2">
                      {!notification.read_at && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                      <span className={`flex-1 truncate font-medium ${notification.read_at ? 'text-muted-foreground' : ''}`}>
                        {notification.title}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {notification.body && (
                      <span className="text-xs text-muted-foreground line-clamp-2">{notification.body}</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
                <BellOff className="h-6 w-6 text-muted-foreground/50" />
                You&apos;re all caught up
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        {authLoading ? (
          <div className="h-8 w-8 rounded-full bg-secondary animate-pulse" />
        ) : user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary">
                  {profile?.full_name ? (
                    <span className="text-sm font-medium">
                      {profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </span>
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </div>
                <span className="sr-only">User menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{profile?.full_name || 'User'}</span>
                  <span className="text-xs font-normal text-muted-foreground">{profile?.email || user.email}</span>
                  <span className="text-xs font-normal text-primary capitalize mt-1">{profile?.role || 'member'}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
               <DropdownMenuItem asChild>
                 <Link href="/configure" className="flex items-center gap-2">
                   <Settings className="h-4 w-4" />
                   Configure Workspace
                 </Link>
               </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive flex items-center gap-2"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/auth/sign-up">Get Started</Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
