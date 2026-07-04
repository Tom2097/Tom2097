import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { requireAdminRole } from "@/lib/platform/admin-roles"

export const dynamic = "force-dynamic"

export async function GET() {
  const role = await requireAdminRole("super_admin", "billing_admin", "read_only_admin")
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const supabase = createServiceClient()

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, slug, created_at, owner_id, status")
    .order("created_at", { ascending: false })
    .limit(50)

  if (!orgs) return NextResponse.json({ tenants: [] })

  const tenants = await Promise.all(
    orgs.map(async (org) => {
      const { count: userCount } = await supabase
        .from("profiles")
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

  return NextResponse.json({ tenants })
}
