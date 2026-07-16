import { NextResponse, type NextRequest } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { createRecordingUpload, listRecordings } from "@/lib/audio/ingestion"

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const recordings = await listRecordings(organizationId)
    return NextResponse.json({ recordings })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { name, size, type } = await request.json()
    if (!name || typeof size !== "number") {
      return NextResponse.json({ error: "name and size are required" }, { status: 400 })
    }
    const result = await createRecordingUpload(organizationId, user.id, { name, size, type: type || "audio/mpeg" })
    return NextResponse.json(result)
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
