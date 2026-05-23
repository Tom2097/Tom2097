'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  BarChart3, 
  Users, 
  Heart, 
  Building2, 
  Wheat, 
  Pill,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Brain,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const modules = [
  { id: 'analytics', title: 'AI Analytics', icon: BarChart3, href: '/analytics' },
  { id: 'crm', title: 'Smart CRM', icon: Users, href: '/crm' },
  { id: 'healthcare', title: 'Healthcare AI', icon: Heart, href: '/healthcare' },
  { id: 'banking', title: 'Banking Intelligence', icon: Building2, href: '/banking' },
  { id: 'agro', title: 'Agro-Tech', icon: Wheat, href: '/agro' },
  { id: 'pharma', title: 'Pharma Intelligence', icon: Pill, href: '/pharma' },
]

export function Sidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)

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
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary digit-glow-sm">
                <span className="text-sm font-bold text-primary-foreground">D</span>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-wider text-foreground">DigiT</h1>
                <p className="text-[10px] text-muted-foreground">Enterprise Intelligence</p>
              </div>
            </Link>
          )}
          {isCollapsed && (
            <Link href="/" className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-primary digit-glow-sm">
              <span className="text-sm font-bold text-primary-foreground">D</span>
            </Link>
          )}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
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

          {/* AI Intelligence Link */}
          <Link
            href="/intelligence"
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              pathname === '/intelligence'
                ? "bg-gradient-to-r from-primary/20 to-cyan-500/20 text-primary digit-glow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <Brain className="h-5 w-5 shrink-0" />
            {!isCollapsed && (
              <span className="flex items-center gap-2">
                AI Intelligence
                <Sparkles className="h-3 w-3 text-cyan-500" />
              </span>
            )}
          </Link>

          {/* Onboarding Link */}
          <Link
            href="/onboarding"
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all border border-dashed",
              pathname === '/onboarding'
                ? "bg-primary/10 text-primary border-primary digit-glow-sm"
                : "text-muted-foreground border-muted-foreground/30 hover:bg-secondary hover:text-foreground hover:border-primary/50"
            )}
          >
            <Sparkles className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>Setup Wizard</span>}
          </Link>

          {/* Separator */}
          {!isCollapsed && (
            <div className="py-3">
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                AI Modules
              </p>
            </div>
          )}
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
        <div className="border-t border-border/50 p-3">
          <Link
            href="/pricing"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
          >
            <CreditCard className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>Pricing & Plans</span>}
          </Link>
        </div>
      </div>
    </aside>
  )
}
