import { NextResponse } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"

/**
 * Backs the "Resolve Now" button in components/digit/intelligence-command-center.tsx,
 * which POSTs { actionId: findingId } here (the button resolves a specific
 * intelligence_findings row, not an agent_actions row -- see resolveFinding()
 * in that component). This route previously didn't exist, so the button
 * 404'd silently. It now really updates the finding's status, org-scoped,
 * following the same getAuthenticatedUser/getOrganizationId + service-client
 * pattern as the sibling routes in this directory (e.g. findings/route.ts).
 */

const executeSchema = z.object({
  actionId: z.string().trim().min(1),
})

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const parsed = executeSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: "actionId is required" }, { status: 400 })
    }

    const db = createServiceClient()
    const { data, error } = await db
      .from("intelligence_findings")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.actionId)
      .eq("organization_id", organizationId)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: "Finding not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, finding: data })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
