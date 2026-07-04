import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { requireAdminRole } from "@/lib/platform/admin-roles"

export const dynamic = "force-dynamic"

export async function GET() {
  const role = await requireAdminRole("super_admin", "billing_admin", "read_only_admin")
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const supabase = createServiceClient()
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, organization_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100)

  return NextResponse.json({ users: profiles || [] })
}
