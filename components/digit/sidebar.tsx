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

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const modules = [
  { id: 'analytics', title: 'AI Analytics', icon: BarChart3, href: '/analytics' },
  { id: 'crm', title: 'Smart CRM', icon: Users, href: '/crm' },
  { id: 'workspace-1', title: 'Operations Workspace', icon: LayoutGrid, href: '/operations' },
  { id: 'workspace-2', title: 'Performance Workspace', icon: Activity, href: '/performance' },
  { id: 'workspace-3', title: 'Resource Workspace', icon: Boxes, href: '/resources' },
  { id: 'workspace-4', title: 'Compliance Workspace', icon: ShieldCheck, href: '/compliance' },
  { id: 'feedback', title: 'Feedback', icon: MessageSquarePlus, href: '/feedback' },
]

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { data: ownerData } = useSWR<{ isOwner: boolean }>('/api/platform/owner-check', fetcher)
  const isOwner = ownerData?.isOwner ?? false

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
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {/* Dashboard Link */}
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
            {!isCollapsed && <span>Dashboard</span>}
          </Link>

           {/* Dashboard Link */}
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
             {!isCollapsed && <span>Dashboard</span>}
           </Link>



           {/* Separator */}
           {!isCollapsed && <div className="h-4" />}
           {isCollapsed && <div className="h-4" />}

          {/* Module Links */}
          {modules.map((module) => {
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
                title={isCollapsed ? module.title : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span>{module.title}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border/50 p-3 space-y-1">
          {isOwner && (
            <Link
              href="/platform/capacity"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                pathname === '/platform/capacity'
                  ? "bg-primary/10 text-primary digit-glow-sm"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              title={isCollapsed ? 'Platform Capacity' : undefined}
            >
              <Gauge className="h-5 w-5 shrink-0" />
              {!isCollapsed && (
                <span className="flex items-center gap-2">
                  Platform Capacity
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    Owner
                  </span>
                </span>
              )}
            </Link>
          )}
          <Link
            href="/pricing"
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              pathname === '/pricing'
                ? "bg-primary/10 text-primary digit-glow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
            title={isCollapsed ? 'Pricing & Plans' : undefined}
          >
            <CreditCard className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>Pricing & Plans</span>}
          </Link>
          <Link
            href="/configure"
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              pathname === '/configure'
                ? "bg-primary/10 text-primary digit-glow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
            title={isCollapsed ? 'Configure Workspace' : undefined}
          >
            <Settings className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>Configure Workspace</span>}
          </Link>
        </div>
      </div>
    </aside>
  )
}
