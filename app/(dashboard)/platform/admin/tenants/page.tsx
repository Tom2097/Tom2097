import { isCurrentUserPlatformOwner } from "@/lib/platform/owner"
import { createServiceClient } from "@/lib/supabase/service"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, Users, ChevronRight } from "lucide-react"

export const dynamic = "force-dynamic"

async function getTenants() {
  const supabase = createServiceClient()
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, slug, created_at, owner_id")
    .order("created_at", { ascending: false })
    .limit(50)

  if (!orgs) return []

  const tenants = await Promise.all(
    orgs.map(async (org) => {
      const { count: userCount } = await supabase
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", org.id)

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan_id, status")
        .eq("organization_id", org.id)
        .maybeSingle()

      return { ...org, userCount: userCount || 0, subscription: sub }
    })
  )

  return tenants
}

export default async function AdminTenantsPage() {
  const isOwner = await isCurrentUserPlatformOwner()
  if (!isOwner) notFound()

  const tenants = await getTenants()

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
              <div key={tenant.id} className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-primary/30 transition-colors">
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
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
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
