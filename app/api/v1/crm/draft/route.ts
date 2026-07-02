import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { draftCrmMessage, generateFollowUpCadence } from "@/lib/crm/ai-drafting"

const handler = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  try {
    const body = await req.json() as {
      action?: string
      contextType: string
      recipientName?: string
      recipientTitle?: string
      companyName?: string
      dealName?: string
      dealStage?: string
      dealValue?: number
      previousInteraction?: string
      tone?: string
      keyPoints?: string[]
      contactId?: string
      dealId?: string
      // For follow-up cadence
      contactName?: string
      numberOfSteps?: number
    }

    if (body.action === "cadence") {
      const cadence = await generateFollowUpCadence(
        organizationId,
        userId,
        body.contactName || "Prospect",
        body.dealName || "Deal",
        body.numberOfSteps || 4,
      )
      return NextResponse.json({ cadence })
    }

    const draft = await draftCrmMessage({
      organizationId,
      userId,
      contextType: body.contextType as any,
      recipientName: body.recipientName,
      recipientTitle: body.recipientTitle,
      companyName: body.companyName,
      dealName: body.dealName,
      dealStage: body.dealStage,
      dealValue: body.dealValue,
      previousInteraction: body.previousInteraction,
      tone: body.tone as any,
      keyPoints: body.keyPoints,
      contactId: body.contactId,
      dealId: body.dealId,
    })

    if (!draft) {
      return NextResponse.json({ error: "Failed to generate draft" }, { status: 500 })
    }

    return NextResponse.json({ draft })
  } catch (err) {
    console.error("[crm-draft] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export const POST = handler
