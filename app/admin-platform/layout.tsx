import { getTranslator } from "@/lib/i18n/server"
import { ReactNode } from "react"
import { redirect } from "next/navigation"
import { getAuthenticatedUser } from "@/lib/auth/server-auth"
import { isPlatformAdmin } from "@/lib/auth/rbac"

interface AdminPlatformLayoutProps {
  children: ReactNode
}

export default async function AdminPlatformLayout({
  children,
}: AdminPlatformLayoutProps) {
  const { t } = await getTranslator()
  const user = await getAuthenticatedUser()
  
  if (!user) {
    redirect("/login")
  }
  
  const isAdmin = await isPlatformAdmin(user.id)
  if (!isAdmin) {
    redirect("/unauthorized")
  }
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex">
        <aside className="w-64 bg-white dark:bg-gray-800 border-r dark:border-gray-700 h-screen sticky top-0">
          <div className="p-4 border-b dark:border-gray-700">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t("adminPlatform.layout.title")}</h1>
          </div>
          <nav className="p-4 space-y-2">
            <a href="/admin-platform/tenants" className="block px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">{t("adminPlatform.layout.tenants")}</a>
            <a href="/admin-platform/users" className="block px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">{t("adminPlatform.layout.users")}</a>
            <a href="/admin-platform/security" className="block px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">{t("adminPlatform.layout.security")}</a>
            <a href="/admin-platform/audit" className="block px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">{t("adminPlatform.layout.auditLogs")}</a>
            <a href="/admin-platform/billing" className="block px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">{t("adminPlatform.layout.billing")}</a>
            <a href="/admin-platform/jit" className="block px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">{t("adminPlatform.layout.jitAccess")}</a>
            <a href="/admin-platform/feature-flags" className="block px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">{t("adminPlatform.layout.featureFlags")}</a>
            <a href="/admin-platform/impersonate" className="block px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">{t("adminPlatform.layout.impersonate")}</a>
            <a href="/admin-platform/break-glass" className="block px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">{t("adminPlatform.layout.breakGlass")}</a>
          </nav>
        </aside>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}