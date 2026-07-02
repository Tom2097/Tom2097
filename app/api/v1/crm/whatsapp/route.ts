import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { sendCrmWhatsApp, getCrmWhatsAppConfig, getWhatsAppMessageHistory } from "@/lib/crm/whatsapp"

const handler = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  try {
    const method = req.method

    if (method === "GET") {
      const contactId = req.nextUrl.searchParams.get("contactId")
      if (!contactId) {
        return NextResponse.json({ error: "contactId required" }, { status: 400 })
      }
      const history = await getWhatsAppMessageHistory(organizationId, contactId)
      return NextResponse.json({ history })
    }

    const body = await req.json() as {
      action?: string
      to: string
      body: string
      contactId?: string
      dealId?: string
    }

    if (body.action === "config") {
      const config = await getCrmWhatsAppConfig(organizationId)
      return NextResponse.json({ config })
    }

    if (!body.to || !body.body) {
      return NextResponse.json({ error: "to and body required" }, { status: 400 })
    }

    const sent = await sendCrmWhatsApp(
      organizationId,
      userId,
      body.to,
      body.body,
      body.contactId,
      body.dealId,
    )

    if (!sent) {
      return NextResponse.json({ error: "WhatsApp API not configured" }, { status: 503 })
    }

    return NextResponse.json({ sent: true })
  } catch (err) {
    console.error("[crm-whatsapp] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export { handler as POST, handler as GET }
