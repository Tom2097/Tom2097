import { NextRequest, NextResponse } from "next/server"
import { verifyWhatsAppWebhook, parseWhatsAppWebhookPayload, ingestWhatsAppMessage } from "@/lib/operational/whatsapp"
import { handleIncomingCrmWhatsApp, getCrmWhatsAppConfig } from "@/lib/crm/whatsapp"
import { createServiceClient } from "@/lib/supabase/service"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  const result = await verifyWhatsAppWebhook(mode, token, challenge)
  if (result) {
    return new NextResponse(result, { status: 200 })
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const messages = await parseWhatsAppWebhookPayload(body)

    if (messages.length === 0) {
      return NextResponse.json({ received: true })
    }

    const db = createServiceClient()

    for (const msg of messages) {
      const { data: orgs } = await db
        .from("organization_settings")
        .select("id")
        .not("whatsapp_config", "is", null)
        .limit(1)

      const orgIds = ((orgs ?? []) as Array<{ id: string }>).map((o) => o.id)

      for (const orgId of orgIds) {
        await ingestWhatsAppMessage(orgId, msg)
        const config = await getCrmWhatsAppConfig(orgId)
        await handleIncomingCrmWhatsApp(orgId, msg, config)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("[whatsapp] Webhook error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
