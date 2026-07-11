"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Shield, Users, Lock, FileText, CreditCard, Clock, Flag, UserCheck, AlertTriangle } from "lucide-react"

export default function AdminPlatformDashboard() {
  const { t } = useI18n()
  const adminSections = [
    {
      title: t("adminPlatform.page.tenants"),
      description: t("adminPlatform.page.tenantsDesc"),
      href: "/admin-platform/tenants",
      icon: <Users className="h-6 w-6" />,
    },
    {
      title: t("adminPlatform.page.users"),
      description: t("adminPlatform.page.usersDesc"),
      href: "/admin-platform/users",
      icon: <UserCheck className="h-6 w-6" />,
    },
    {
      title: t("adminPlatform.page.security"),
      description: t("adminPlatform.page.securityDesc"),
      href: "/admin-platform/security",
      icon: <Lock className="h-6 w-6" />,
    },
    {
      title: t("adminPlatform.page.auditLogs"),
      description: t("adminPlatform.page.auditLogsDesc"),
      href: "/admin-platform/audit",
      icon: <FileText className="h-6 w-6" />,
    },
    {
      title: t("adminPlatform.page.billing"),
      description: t("adminPlatform.page.billingDesc"),
      href: "/admin-platform/billing",
      icon: <CreditCard className="h-6 w-6" />,
    },
    {
      title: t("adminPlatform.page.jitAccess"),
      description: t("adminPlatform.page.jitAccessDesc"),
      href: "/admin-platform/jit",
      icon: <Clock className="h-6 w-6" />,
    },
    {
      title: t("adminPlatform.page.featureFlags"),
      description: t("adminPlatform.page.featureFlagsDesc"),
      href: "/admin-platform/feature-flags",
      icon: <Flag className="h-6 w-6" />,
    },
    {
      title: t("adminPlatform.page.impersonate"),
      description: t("adminPlatform.page.impersonateDesc"),
      href: "/admin-platform/impersonate",
      icon: <Users className="h-6 w-6" />,
    },
    {
      title: t("adminPlatform.page.breakGlass"),
      description: t("adminPlatform.page.breakGlassDesc"),
      href: "/admin-platform/break-glass",
      icon: <AlertTriangle className="h-6 w-6" />,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("adminPlatform.page.title")}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t("adminPlatform.page.subtitle")}</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {adminSections.map((section) => (
          <Card key={section.href} className="hover:shadow-md transition-shadow">
            <a href={section.href}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-lg font-medium">{section.title}</CardTitle>
                {section.icon}
              </CardHeader>
              <CardContent>
                <CardDescription>{section.description}</CardDescription>
              </CardContent>
            </a>
          </Card>
        ))}
      </div>
    </div>
  )
}