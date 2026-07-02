import { createServiceClient } from "@/lib/supabase/service"
import { classifyText } from "@/lib/analytics/nlp"
import { dispatchDocumentEvent } from "@/lib/documents/events"
import { ingestVoiceNote } from "./intake"

export interface WhatsAppMessage {
  id: string
  from: string
  body: string
  type: "text" | "image" | "voice" | "document" | "video"
  mediaUrl?: string
  timestamp: string
}

export interface WhatsAppTemplate {
  id: string
  name: string
  language: string
  components: Array<{ type: string; text?: string }>
}

const WHATSAPP_API_BASE = "https://graph.facebook.com/v21.0"

function getPhoneNumberId(): string {
  return process.env.WHATSAPP_PHONE_NUMBER_ID || ""
}

function getApiToken(): string {
  return process.env.WHATSAPP_API_TOKEN || ""
}

export async function sendWhatsAppMessage(
  to: string,
  body: string,
): Promise<boolean> {
  const token = getApiToken()
  const phoneNumberId = getPhoneNumberId()
  if (!token || !phoneNumberId) return false

  try {
    const res = await fetch(`${WHATSAPP_API_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body },
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  parameters: string[],
): Promise<boolean> {
  const token = getApiToken()
  const phoneNumberId = getPhoneNumberId()
  if (!token || !phoneNumberId) return false

  try {
    const res = await fetch(`${WHATSAPP_API_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: "en" },
          components: [{
            type: "body",
            parameters: parameters.map((p) => ({ type: "text", text: p })),
          }],
        },
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function ingestWhatsAppMessage(
  organizationId: string,
  msg: WhatsAppMessage,
): Promise<string | null> {
  const db = createServiceClient()
  const sourceType = msg.type === "voice" ? "voice_transcript" : "whatsapp_message"

  const { data: doc } = await db.from("documents").insert({
    organization_id: organizationId,
    name: `WhatsApp: ${msg.from}`,
    type: sourceType,
    content: msg.body,
    storage_path: msg.mediaUrl ?? null,
    mime_type: msg.type === "image" ? "image/jpeg" : msg.type === "voice" ? "audio/ogg" : "text/plain",
    metadata: {
      source: "whatsapp",
      whatsapp_message_id: msg.id,
      from: msg.from,
      message_type: msg.type,
      received_at: msg.timestamp,
    },
  }).select("id").single()

  if (!doc) return null
  const docId = doc.id as string

  const result = await classifyText(msg.body.slice(0, 5000)).catch(() => null)
  await dispatchDocumentEvent({
    type: "document.created",
    organization_id: organizationId,
    document_id: docId,
    actor_id: null,
    metadata: { source: "whatsapp", classification: result?.primary ?? null },
  })

  if (msg.type === "voice") {
    await ingestVoiceNote(organizationId, msg.body, `voice-${msg.id}.ogg`)
  }

  return docId
}

export async function verifyWhatsAppWebhook(
  mode: string | null,
  token: string | null,
  challenge: string | null,
): Promise<string | null> {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN
  if (mode === "subscribe" && token === verifyToken && challenge) {
    return challenge
  }
  return null
}

export async function parseWhatsAppWebhookPayload(
  body: unknown,
): Promise<WhatsAppMessage[]> {
  const messages: WhatsAppMessage[] = []
  const entry = (body as any)?.entry
  if (!Array.isArray(entry)) return messages

  for (const e of entry) {
    const changes = e?.changes
    if (!Array.isArray(changes)) continue
    for (const c of changes) {
      const value = c?.value
      const contacts = value?.contacts ?? []
      const msgs = value?.messages ?? []
      for (const m of msgs) {
        const from = contacts[0]?.wa_id ?? m.from ?? "unknown"
        messages.push({
          id: m.id,
          from,
          body: m.text?.body ?? m.caption ?? "",
          type: m.type ?? "text",
          mediaUrl: m.image?.id ?? m.audio?.id ?? m.video?.id ?? m.document?.id ?? null,
          timestamp: m.timestamp ?? new Date().toISOString(),
        })
      }
    }
  }
  return messages
}
