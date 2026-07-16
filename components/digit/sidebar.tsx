'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import {
  BarChart3, 
  Users, 
  LayoutGrid,
  Activity,
  Boxes,
  ShieldCheck,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Brain,
  Sparkles,
  MessageSquarePlus,
  Gauge,
  Settings,
  HelpCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo, LogoIcon } from '@/components/digit/logo'
import { useI18n } from '@/components/providers/i18n-provider'
const fetcher = (url: string) => fetch(url).then((r) => r.json())

// Base modules available to all users
const BASE_MODULES = [
  { id: 'crm', title: 'Smart CRM', icon: Users, href: '/crm' },
  { id: 'operations', title: 'Operations', icon: LayoutGrid, href: '/operations' },
  { id: 'performance', title: 'Performance', icon: Activity, href: '/performance' },
  { id: 'resources', title: 'Resources', icon: Boxes, href: '/resources' },
  { id: 'compliance', title: 'Compliance', icon: ShieldCheck, href: '/compliance' },
  { id: 'feedback', title: 'Feedback', icon: MessageSquarePlus, href: '/feedback' },
]

// AI-related modules (controlled by feature flags)
const AI_MODULES = [
  { id: 'intelligence', title: 'AI Intelligence', icon: Brain, href: '/intelligence', flag: 'ai_intelligence' },
  { id: 'analytics', title: 'AI Analytics', icon: BarChart3, href: '/analytics', flag: 'advanced_analytics' },
]

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { t } = useI18n()
  const { data: ownerData } = useSWR<{ isOwner: boolean }>('/api/platform/owner-check', fetcher)
  const isOwner = ownerData?.isOwner ?? false
  
  // Fetch feature flags
  const { data: featureFlags } = useSWR<Record<string, boolean>>(
    '/api/v1/feature-flags',
    fetcher,
    { fallbackData: { ai_intelligence: true, advanced_analytics: true } }
  )

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-border/50 bg-sidebar transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-border/50 px-4">
          {!isCollapsed && (
            <Logo size="sm" link />
          )}
          {isCollapsed && (
            <Link href="/" className="mx-auto">
              <LogoIcon size="sm" />
            </Link>
          )}
          <button 
            onClick={onToggle}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto p-3">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              pathname === '/'
                ? "bg-primary/10 text-primary digit-glow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <LayoutDashboard className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>{t('sidebar.dashboard')}</span>}
          </Link>

          {!isCollapsed && <div className="h-4" />}
          {isCollapsed && <div className="h-4" />}

          {/* Module Links */}
          {BASE_MODULES.map((module) => {
            const Icon = module.icon
            const isActive = pathname === module.href
            
            return (
              <Link
                key={module.id}
                href={module.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary digit-glow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
                title={isCollapsed ? t(`sidebar.${module.id}`) : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span>{t(`sidebar.${module.id}`)}</span>}
              </Link>
            )
          })}
          
          {/* AI Modules (conditional based on feature flags) */}
          {AI_MODULES.map((module) => {
            const Icon = module.icon
            const isActive = pathname === module.href
            const isEnabled = featureFlags?.[module.flag as keyof typeof featureFlags] ?? true
            
            if (!isEnabled) return null
            
            return (
              <Link
                key={module.id}
                href={module.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary digit-glow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
                title={isCollapsed ? t(`sidebar.${module.id}`) : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span>{t(`sidebar.${module.id}`)}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border/50 p-3 space-y-1">
          {isOwner && (
            <>
              <Link
                href="/platform/admin/dashboard"
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  pathname?.startsWith('/platform/admin')
                    ? "bg-primary/10 text-primary digit-glow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
                title={isCollapsed ? t('sidebar.admin') : undefined}
              >
                <Activity className="h-5 w-5 shrink-0" />
                {!isCollapsed && (
                  <span className="flex items-center gap-2">
                    {t('sidebar.admin')}
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      Owner
                    </span>
                  </span>
                )}
              </Link>
              <Link
                href="/platform/capacity"
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  pathname === '/platform/capacity'
                    ? "bg-primary/10 text-primary digit-glow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
                title={isCollapsed ? t('sidebar.platformCapacity') : undefined}
              >
                <Gauge className="h-5 w-5 shrink-0" />
                {!isCollapsed && (
                  <span className="flex items-center gap-2">
                    {t('sidebar.platformCapacity')}
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      Owner
                    </span>
                  </span>
                )}
              </Link>
            </>
          )}
          <Link
            href="/pricing"
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              pathname === '/pricing'
                ? "bg-primary/10 text-primary digit-glow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
            title={isCollapsed ? t('sidebar.pricing') : undefined}
          >
            <CreditCard className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>{t('sidebar.pricing')}</span>}
          </Link>
          <Link
            href="/configure"
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              pathname === '/configure'
                ? "bg-primary/10 text-primary digit-glow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
            title={isCollapsed ? t('sidebar.configureWorkspace') : undefined}
          >
            <Settings className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>{t('sidebar.configureWorkspace')}</span>}
          </Link>
        </div>
      </div>
    </aside>
  )
}
