import { isCurrentUserPlatformOwner } from "@/lib/platform/owner"
import { createServiceClient } from "@/lib/supabase/service"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users } from "lucide-react"

export const dynamic = "force-dynamic"

async function getUsers() {
  const supabase = createServiceClient()
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, organization_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100)

  return profiles || []
}

export default async function AdminUsersPage() {
  const isOwner = await isCurrentUserPlatformOwner()
  if (!isOwner) notFound()

  const users = await getUsers()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground mt-1">View all users across the platform</p>
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
                      {user.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "U"}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{user.full_name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{user.role || "member"}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No users found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
