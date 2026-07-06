"use client"

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
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Platform Admin</h1>
          </div>
          <nav className="p-4 space-y-2">
            <a href="/admin-platform/tenants" className="block px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">Tenants</a>
            <a href="/admin-platform/users" className="block px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">Users</a>
            <a href="/admin-platform/security" className="block px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">Security</a>
            <a href="/admin-platform/audit" className="block px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">Audit Logs</a>
            <a href="/admin-platform/billing" className="block px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">Billing</a>
            <a href="/admin-platform/jit" className="block px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">JIT Access</a>
            <a href="/admin-platform/feature-flags" className="block px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">Feature Flags</a>
            <a href="/admin-platform/impersonate" className="block px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">Impersonate</a>
            <a href="/admin-platform/break-glass" className="block px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">Break Glass</a>
          </nav>
        </aside>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}