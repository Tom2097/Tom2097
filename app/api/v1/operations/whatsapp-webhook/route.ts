import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { verifyWhatsAppWebhook, parseWhatsAppWebhookPayload, ingestWhatsAppMessage } from '@/lib/operational/whatsapp'

function hasValidMetaSignature(rawBody: string, signature: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret || !signature?.startsWith('sha256=')) return false

  const supplied = Buffer.from(signature.slice('sha256='.length), 'hex')
  const expected = createHmac('sha256', appSecret).update(rawBody).digest()
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

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
  const rawBody = await request.text()
  if (!hasValidMetaSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  const organizationId = process.env.DEFAULT_OPERATIONS_ORG_ID
  if (!organizationId) {
    console.error('[whatsapp-webhook] DEFAULT_OPERATIONS_ORG_ID is not configured -- dropping message')
    return NextResponse.json({ success: true })
  }

  try {
    const body = JSON.parse(rawBody)
    const messages = await parseWhatsAppWebhookPayload(body)
    await Promise.all(messages.map((msg) => ingestWhatsAppMessage(organizationId, msg)))
  } catch (error) {
    console.error('[whatsapp-webhook] error:', error)
  }

  return NextResponse.json({ success: true })
}
