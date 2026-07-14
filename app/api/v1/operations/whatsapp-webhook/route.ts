import { NextResponse } from 'next/server'
import { verifyWhatsAppWebhook, parseWhatsAppWebhookPayload, ingestWhatsAppMessage } from '@/lib/operational/whatsapp'

// Meta's webhook verification handshake: echo back hub.challenge as plain
// text if hub.verify_token matches WHATSAPP_VERIFY_TOKEN.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const challenge = await verifyWhatsAppWebhook(
    searchParams.get('hub.mode'),
    searchParams.get('hub.verify_token'),
    searchParams.get('hub.challenge'),
  )
  if (challenge) {
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

// Real inbound messages. Which organization these belong to isn't
// resolvable from the payload today (a single WhatsApp Business number
// isn't tied to a tenant anywhere) -- routes to DEFAULT_OPERATIONS_ORG_ID,
// which must be set once a real WhatsApp Business account is configured.
// Always acks 200 fast, per Meta's webhook requirements, even on internal
// failure -- Meta retries aggressively on non-200s.
export async function POST(request: Request) {
  const organizationId = process.env.DEFAULT_OPERATIONS_ORG_ID
  if (!organizationId) {
    console.error('[whatsapp-webhook] DEFAULT_OPERATIONS_ORG_ID is not configured -- dropping message')
    return NextResponse.json({ success: true })
  }

  try {
    const body = await request.json()
    const messages = await parseWhatsAppWebhookPayload(body)
    await Promise.all(messages.map((msg) => ingestWhatsAppMessage(organizationId, msg)))
  } catch (error) {
    console.error('[whatsapp-webhook] error:', error)
  }

  return NextResponse.json({ success: true })
}
