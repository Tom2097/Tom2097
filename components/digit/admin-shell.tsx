"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCheck,
  ShieldAlert,
  Shield,
  Settings,
  ChevronLeft,
  ChevronRight,
  Activity,
  IndianRupee,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { Badge } from "@/components/ui/badge"
import { AuroraBackground } from "@/components/digit/aurora-background"

const ADMIN_NAV = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/admin" },
  { label: "Tenants", icon: Building2, href: "/admin/tenants" },
  { label: "Users", icon: Users, href: "/admin/users" },
  { label: "Impersonation", icon: UserCheck, href: "/admin/impersonation" },
  { label: "JIT Access", icon: ShieldAlert, href: "/admin/jit" },
  { label: "Security", icon: Shield, href: "/admin/security" },
  { label: "Revenue", icon: IndianRupee, href: "/admin/revenue" },
  { label: "Feature Flags", icon: Settings, href: "/admin/feature-flags" },
  { label: "Incidents", icon: Activity, href: "/admin/incidents" },
]

export function AdminShell({
  children,
}: {
  children: React.ReactNode
}) {
  const { t } = useI18n()
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="relative min-h-screen bg-background">
      <AuroraBackground />

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r border-border/50 bg-sidebar transition-all duration-300",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b border-border/50 px-4">
            {!isCollapsed && (
              <Link href="/admin" className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <span className="text-base font-bold">{t("admin.layout.admin")}</span>
              </Link>
            )}
            {isCollapsed && (
              <Link href="/admin" className="mx-auto">
                <Activity className="h-5 w-5 text-primary" />
              </Link>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label={isCollapsed ? t("admin.layout.expandSidebar") : t("admin.layout.collapseSidebar")}
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto p-3">
            {ADMIN_NAV.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || (pathname && item.href !== "/admin" && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-primary/10 text-primary digit-glow-sm"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              )
            })}
          </nav>

          <div className="border-t border-border/50 p-3">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
            >
              <LayoutDashboard className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span>{t("admin.layout.backToDashboard")}</span>}
            </Link>
          </div>
        </div>
      </aside>

      <div
        className={cn(
          "transition-all duration-300 ease-in-out",
          isCollapsed ? "ml-16" : "ml-64"
        )}
      >
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 bg-background/80 px-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Badge variant="default" className="bg-primary/15 text-primary hover:bg-primary/20">
              <Activity className="mr-1 h-3 w-3" />
              Admin
            </Badge>
            <span className="text-sm text-muted-foreground">{t("admin.layout.platformAdministration")}</span>
          </div>
        </header>

        <main className="relative min-h-[calc(100vh-4rem)] p-6">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
