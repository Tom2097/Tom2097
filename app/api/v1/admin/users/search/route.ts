import { NextResponse, type NextRequest } from "next/server"
import { getAuthenticatedUser, handleAuthError } from "@/lib/auth/server-auth"
import { isCurrentUserPlatformOwner } from "@/lib/platform/owner"
import { createServiceClient } from "@/lib/supabase/service"

export async function GET(request: NextRequest) {
  try {
    await getAuthenticatedUser()
    const isOwner = await isCurrentUserPlatformOwner()
    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 })
    }

    const db = createServiceClient()
    const { data: profile } = await db
      .from("profiles")
      .select("id, email, full_name, organization_id, organizations(name)")
      .eq("email", email)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: "No user found for this email" }, { status: 404 })
    }

    return NextResponse.json({
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.full_name ?? "Unnamed",
        orgName: (profile.organizations as unknown as { name: string } | null)?.name ?? "—",
      },
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
