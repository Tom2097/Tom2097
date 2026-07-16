import { NextResponse, type NextRequest } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { getRecording, deleteRecording } from "@/lib/audio/ingestion"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const recording = await getRecording(organizationId, id)
    if (!recording) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ recording })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const ok = await deleteRecording(organizationId, id)
    if (!ok) return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
