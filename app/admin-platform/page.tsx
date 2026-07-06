"use client"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Shield, Users, Lock, FileText, CreditCard, Clock, Flag, UserCheck, AlertTriangle } from "lucide-react"

const adminSections = [
  {
    title: "Tenants",
    description: "Manage tenant provisioning, suspension, and lifecycle.",
    href: "/admin-platform/tenants",
    icon: <Users className="h-6 w-6" />,
  },
  {
    title: "Users",
    description: "Manage platform users and roles.",
    href: "/admin-platform/users",
    icon: <UserCheck className="h-6 w-6" />,
  },
  {
    title: "Security",
    description: "Configure IP allowlists, VPN, and authentication policies.",
    href: "/admin-platform/security",
    icon: <Lock className="h-6 w-6" />,
  },
  {
    title: "Audit Logs",
    description: "Immutable audit trail with SIEM integration.",
    href: "/admin-platform/audit",
    icon: <FileText className="h-6 w-6" />,
  },
  {
    title: "Billing",
    description: "Manage subscriptions, dunning, and proration.",
    href: "/admin-platform/billing",
    icon: <CreditCard className="h-6 w-6" />,
  },
  {
    title: "JIT Access",
    description: "Just-in-Time access requests and approvals.",
    href: "/admin-platform/jit",
    icon: <Clock className="h-6 w-6" />,
  },
  {
    title: "Feature Flags",
    description: "Manage feature flags and kill switches.",
    href: "/admin-platform/feature-flags",
    icon: <Flag className="h-6 w-6" />,
  },
  {
    title: "Impersonate",
    description: "Time-boxed impersonation with audit trail.",
    href: "/admin-platform/impersonate",
    icon: <Users className="h-6 w-6" />,
  },
  {
    title: "Break Glass",
    description: "Emergency access with alarms and time-bound constraints.",
    href: "/admin-platform/break-glass",
    icon: <AlertTriangle className="h-6 w-6" />,
  },
]

export default function AdminPlatformDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Admin Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400">Cross-tenant operations and hardened controls</p>
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