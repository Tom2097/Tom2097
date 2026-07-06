import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { uploadRecording, listRecordings, updateRecordingStatus } from '@/lib/audio/ingestion'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const orgId = await getOrganizationId(user.id)
    const body = await request.json()
    const { name, size, type } = body
    if (!name || !size || !type) {
      return NextResponse.json({ error: 'Missing required fields: name, size, type' }, { status: 400 })
    }
    const recording = uploadRecording(orgId, { name, size: Number(size), type })
    return NextResponse.json({ recording }, { status: 201 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function GET(_request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const orgId = await getOrganizationId(user.id)
    const recordings = listRecordings(orgId)
    return NextResponse.json({ recordings })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await getAuthenticatedUser()
    const body = await request.json()
    const { id, status } = body
    if (!id || !status) {
      return NextResponse.json({ error: 'Missing required fields: id, status' }, { status: 400 })
    }
    const recording = updateRecordingStatus(id, status)
    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
    }
    return NextResponse.json({ recording })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
