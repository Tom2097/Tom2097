import { NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'
import { ingestFromEmail } from '@/lib/operational/intake'

export const maxDuration = 30

function sha256(value: string) {
  return createHash('sha256').update(value).digest()
}

// Inbound-parse providers can't sign requests with our keys, but they can call
// a URL containing a secret, so accept it as ?token= or a Bearer header. Fails
// closed when INBOUND_EMAIL_SECRET isn't set.
function hasValidSecret(request: Request): boolean {
  const secret = process.env.INBOUND_EMAIL_SECRET
  if (!secret) return false

  const header = request.headers.get('authorization')
  const supplied = header?.startsWith('Bearer ')
    ? header.slice('Bearer '.length)
    : new URL(request.url).searchParams.get('token')
  return !!supplied && timingSafeEqual(sha256(supplied), sha256(secret))
}

// Accepts an inbound-parse webhook payload (e.g. SendGrid Inbound Parse's
// multipart shape: from/subject/text fields + attachment files). Which
// organization a message belongs to isn't resolvable from the payload today
// -- routes to DEFAULT_OPERATIONS_ORG_ID, same as the WhatsApp webhook.
export async function POST(request: Request) {
  if (!hasValidSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const organizationId = process.env.DEFAULT_OPERATIONS_ORG_ID
  if (!organizationId) {
    console.error('[ingest-email] DEFAULT_OPERATIONS_ORG_ID is not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  try {
    const contentType = request.headers.get('content-type') || ''
    let from = ''
    let subject = ''
    let body = ''
    const attachments: Array<{ name: string; content: string }> = []

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      from = String(formData.get('from') ?? '')
      subject = String(formData.get('subject') ?? '')
      body = String(formData.get('text') ?? formData.get('html') ?? '')
      for (const [key, value] of formData.entries()) {
        if (value instanceof File && key !== 'attachment-info') {
          attachments.push({ name: value.name, content: await value.text().catch(() => '') })
        }
      }
    } else {
      const json = await request.json()
      from = json.from ?? ''
      subject = json.subject ?? ''
      body = json.text ?? json.body ?? ''
    }

    if (!from || !body) {
      return NextResponse.json({ error: 'from and text/body are required' }, { status: 400 })
    }

    const docIds = await ingestFromEmail(organizationId, from, subject, body, attachments.length > 0 ? attachments : undefined)
    return NextResponse.json({ success: true, document_ids: docIds })
  } catch (error) {
    console.error('[ingest-email] error:', error)
    return NextResponse.json({ error: 'Failed to process inbound email' }, { status: 500 })
  }
}
