"use client"

import { useEffect, useState } from "react"
import { notFound, usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Building2,
  Users,
  Shield,
  Activity,
  Loader2,
} from "lucide-react"

const adminNav = [
  { label: "Dashboard", href: "/platform/admin/dashboard", icon: LayoutDashboard },
  { label: "Tenants", href: "/platform/admin/tenants", icon: Building2 },
  { label: "Users", href: "/platform/admin/users", icon: Users },
  { label: "Security", href: "/platform/admin/security", icon: Shield },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isOwner, setIsOwner] = useState<boolean | null>(null)

  useEffect(() => {
    const check = async () => {
      const res = await fetch("/api/platform/owner-check")
      if (!res.ok) { setIsOwner(false); return }
      setIsOwner(true)
    }
    check()
  }, [])

  if (isOwner === false) { notFound() }
  if (isOwner === null) {
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
          <span className="text-sm font-semibold">Platform Admin</span>
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
