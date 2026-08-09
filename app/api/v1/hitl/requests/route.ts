import { NextResponse } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { listOpenHARsForUser } from "@/lib/hitl/har"

/** "What's waiting on me" -- spec section 7's first chat example, and the
 *  in-app queue's data source. */
export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const requests = await listOpenHARsForUser(organizationId, user.id)
    return NextResponse.json({ requests })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
