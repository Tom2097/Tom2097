"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users as UsersIcon, Loader2, Eye } from "lucide-react"

interface PlatformUser {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
  organization_id: string | null
  created_at: string
}

export default function AdminUsersPage() {
  const { t } = useI18n()
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [loading, setLoading] = useState(true)
  const [impersonating, setImpersonating] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/v1/admin/users")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setUsers(data.users || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleImpersonate = async (userId: string) => {
    setImpersonating(userId)
    try {
      const res = await fetch("/api/v1/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      window.open(data.url, "_blank")
    } catch { /* silent */ }
    finally { setImpersonating(null) }
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><UsersIcon className="w-8 h-8 animate-spin text-primary" /></div>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t("platformAdmin.users.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("platformAdmin.users.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 rounded-lg border border-border/50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {user.full_name?.split(" ").map(n => n[0]).join("").toUpperCase() || "U"}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{user.full_name || t("platformAdmin.users.unknown")}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{user.role || "member"}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                  <Button size="sm" variant="outline" className="gap-1" disabled={impersonating === user.id}
                    onClick={() => handleImpersonate(user.id)}>
                    {impersonating === user.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Eye className="w-3 h-3" />}
                    Impersonate
                  </Button>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <UsersIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("platformAdmin.users.noUsers")}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
