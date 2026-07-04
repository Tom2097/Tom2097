"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Building2, Users, Loader2, PauseCircle, PlayCircle, Trash2 } from "lucide-react"

interface Tenant {
  id: string
  name: string
  slug: string
  created_at: string
  owner_id: string
  userCount: number
  subscription: { plan_id: string; status: string } | null
  status?: string
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [actioning, setActioning] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/v1/admin/tenants")
        if (!res.ok) { setError("Unauthorized"); setLoading(false); return }
        const data = await res.json()
        setTenants(data.tenants || [])
      } catch { setError("Failed to load") }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const handleAction = async (id: string, action: string) => {
    setActioning(id)
    try {
      const res = await fetch(`/api/v1/admin/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error("Failed")
      setTenants(prev => prev.map(t => t.id === id ? { ...t, status: action === "suspend" ? "suspended" : action === "activate" ? "active" : t.status } : t))
      if (action === "delete") setTenants(prev => prev.filter(t => t.id !== id))
    } catch { /* silent */ }
    finally { setActioning(null) }
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  if (error) return <div className="flex items-center justify-center min-h-[60vh] text-destructive">{error}</div>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Tenants</h1>
        <p className="text-muted-foreground mt-1">Manage all organizations on the platform</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Organizations ({tenants.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tenants.map((tenant) => (
              <div key={tenant.id} className="flex items-center justify-between p-4 rounded-lg border border-border/50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{tenant.name}</p>
                    <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    {tenant.userCount}
                  </div>
                  {tenant.subscription ? (
                    <Badge variant={tenant.subscription.status === "active" ? "default" : "secondary"}>
                      {tenant.subscription.plan_id || tenant.subscription.status}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Trial</Badge>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {new Date(tenant.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-8 w-8" disabled={actioning === tenant.id}
                      onClick={() => handleAction(tenant.id, tenant.status === "suspended" ? "activate" : "suspend")}
                      title={tenant.status === "suspended" ? "Activate" : "Suspend"}>
                      {actioning === tenant.id ? <Loader2 className="w-4 h-4 animate-spin" /> :
                        tenant.status === "suspended" ? <PlayCircle className="w-4 h-4 text-chart-2" /> : <PauseCircle className="w-4 h-4 text-amber-500" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8" disabled={actioning === tenant.id}
                      onClick={() => { if (confirm("Delete this tenant permanently?")) handleAction(tenant.id, "delete") }}
                      title="Delete">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {tenants.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No organizations yet</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
