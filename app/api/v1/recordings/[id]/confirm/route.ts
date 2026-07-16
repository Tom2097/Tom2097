import { NextResponse, type NextRequest } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { confirmRecordingUpload } from "@/lib/audio/ingestion"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { durationSeconds } = await request.json().catch(() => ({}))
    const recording = await confirmRecordingUpload(organizationId, id, durationSeconds)
    if (!recording) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ recording })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
