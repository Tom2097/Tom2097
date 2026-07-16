import { NextResponse, type NextRequest } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { updateActionItemStatus, updateActionItemAssignee } from "@/lib/audio/ingestion"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { status, assignee } = await request.json()
    if (status && !(await updateActionItemStatus(organizationId, itemId, status))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (typeof assignee === "string" && !(await updateActionItemAssignee(organizationId, itemId, assignee))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
