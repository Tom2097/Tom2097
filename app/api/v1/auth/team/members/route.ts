import { NextResponse, type NextRequest } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { createServiceClient } from "@/lib/supabase/service"

// GET /api/v1/auth/team/members
// Settings previously only ever showed the logged-in user's own profile --
// there was no team roster anywhere in the app. Any authenticated member of
// the org can see who else is on the team; role changes themselves are
// restricted separately in [userId]/route.ts.
export async function GET(_req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("[team/members] Error fetching team roster:", error)
      return NextResponse.json({ error: "Failed to fetch team members" }, { status: 500 })
    }

    return NextResponse.json({ members: data ?? [] })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
