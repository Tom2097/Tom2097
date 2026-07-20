"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { notFound, usePathname } from "next/navigation"
import Link from "next/link"
import useSWR from "swr"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Building2,
  Users,
  Shield,
  Activity,
  Loader2,
  Wallet,
} from "lucide-react"

// Same key + fetcher as components/digit/sidebar.tsx's owner-check --
// SWR dedupes identical requests, so this reuses the sidebar's already-
// fetched result instead of triggering a second request and a visible
// spinner flash on every admin sub-page navigation.
const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n()
  const pathname = usePathname()
  const adminNav = [
    { label: t("platformAdmin.layout.dashboard"), href: "/platform/admin/dashboard", icon: LayoutDashboard },
    { label: t("platformAdmin.layout.tenants"), href: "/platform/admin/tenants", icon: Building2 },
    { label: t("platformAdmin.layout.users"), href: "/platform/admin/users", icon: Users },
    { label: t("platformAdmin.layout.roles"), href: "/platform/admin/roles", icon: Shield },
    { label: t("platformAdmin.layout.payouts"), href: "/platform/admin/payouts", icon: Wallet },
    { label: t("platformAdmin.layout.security"), href: "/platform/admin/security", icon: Activity },
  ]
  const { data: ownerData, isLoading } = useSWR<{ isOwner: boolean }>("/api/platform/owner-check", fetcher)
  const isOwner = ownerData?.isOwner ?? false

  if (!isLoading && !isOwner) { notFound() }
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside className="w-56 border-r border-border/50 bg-muted/20 p-4 hidden md:block">
        <div className="flex items-center gap-2 px-2 mb-6">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">{t("platformAdmin.layout.platformAdmin")}</span>
        </div>
        <nav className="space-y-1">
          {adminNav.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
      <main className="flex-1 p-6 lg:p-8">
        {children}
      </main>
    </div>
  )
}
