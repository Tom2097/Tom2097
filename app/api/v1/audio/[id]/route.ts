import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, handleAuthError } from '@/lib/auth/server-auth'
import { getRecording, getTranscription, getActionItems, deleteRecording } from '@/lib/audio/ingestion'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getAuthenticatedUser()
    const { id } = await params
    const recording = getRecording(id)
    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
    }
    const transcription = getTranscription(id)
    const actionItems = getActionItems(id)
    return NextResponse.json({ recording, transcription, actionItems })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getAuthenticatedUser()
    const { id } = await params
    const deleted = deleteRecording(id)
    if (!deleted) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
