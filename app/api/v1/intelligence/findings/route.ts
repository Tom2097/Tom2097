import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { createServiceClient } from "@/lib/supabase/service"

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "20")

    const db = createServiceClient()
    const { data, error } = await db
      .from("intelligence_findings")
      .select("*")
      .eq("organization_id", organizationId)
      .order("detected_at", { ascending: false })
      .limit(limit)

    if (error) throw error

    return NextResponse.json({ findings: data || [] })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
