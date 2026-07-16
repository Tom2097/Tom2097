import { NextResponse, type NextRequest } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { processTranscription, extractActionItems } from "@/lib/audio/ingestion"

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const transcription = await processTranscription(organizationId, id)
    const actionItems = await extractActionItems(organizationId, id)
    return NextResponse.json({ transcription, actionItems })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
