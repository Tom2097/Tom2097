import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { sendCommunication, listCommunications } from '@/lib/crm/extensions'
import { sendWhatsAppMessage } from '@/lib/crm/whatsapp'
import { createServiceClient } from '@/lib/supabase/service'
import type { Communication, CommunicationChannel } from '@/lib/crm/types'

function toMessage(comm: Communication) {
  return {
    id: comm.id,
    channel: comm.channel,
    direction: comm.direction,
    subject: comm.subject,
    body: comm.body,
    to: comm.to_address,
    from: comm.from_address,
    timestamp: comm.sent_at,
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { searchParams } = new URL(request.url)
    const { communications } = await listCommunications(organizationId, {
      channel: (searchParams.get('channel') as CommunicationChannel) || undefined,
      contactId: searchParams.get('contactId') || undefined,
      dealId: searchParams.get('dealId') || undefined,
      limit: Number(searchParams.get('limit')) || 50,
    })
    return NextResponse.json({ communications: communications.map(toMessage) })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { channel, to_address, subject, body, contact_id, deal_id, template_id } = await request.json()
    if (!channel || !to_address || !body) {
      return NextResponse.json({ error: 'channel, to_address, and body are required' }, { status: 400 })
    }

    const comm = await sendCommunication(organizationId, user.id, {
      channel,
      direction: 'outbound',
      subject: subject || '',
      body,
      from_address: user.email ?? 'noreply@digit-ai.in',
      to_address,
      contact_id: contact_id || null,
      deal_id: deal_id || null,
      template_id: template_id || null,
    })

    // WhatsApp gets a real delivery attempt (when creds are configured) plus a
    // whatsapp_messages row -- crm_communications above is the channel-agnostic
    // hub record; this is the WhatsApp-specific delivery log.
    if (channel === 'whatsapp') {
      const apiKey = process.env.WHATSAPP_API_KEY
      const apiUrl = process.env.WHATSAPP_API_URL
      let status = 'sent'
      if (apiKey && apiUrl) {
        try {
          await sendWhatsAppMessage({ to: to_address, from: user.email ?? '', body }, apiKey, apiUrl)
        } catch (err) {
          console.error('[crm/communications] WhatsApp send failed:', err)
          status = 'failed'
        }
      } else {
        status = 'queued'
      }
      const db = createServiceClient()
      await db.from('whatsapp_messages').insert({
        organization_id: organizationId,
        deal_id: deal_id || null,
        contact_id: contact_id || null,
        direction: 'outbound',
        message: body,
        status,
      })
    }

    return NextResponse.json(toMessage(comm), { status: 201 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
