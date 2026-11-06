import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/with-auth";
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit";
import { sendWhatsAppMessage, logWhatsAppToDeal, getWhatsAppTemplates } from "../../../../../lib/crm/whatsapp";

// Schema for sending WhatsApp message
const SendWhatsAppSchema = z.object({
  to: z.string().regex(/^\+?[1-9]\d{6,14}$/),
  body: z.string().max(4096).optional(),
  templateName: z.string().optional(),
  templateParams: z.record(z.string(), z.string()).optional(),
  dealId: z.string().optional(),
  contactId: z.string().optional(),
});

// Schema for logging WhatsApp message
const LogWhatsAppSchema = z.object({
  messageId: z.string(),
  dealId: z.string(),
  contactId: z.string().optional(),
});

// GET /api/v1/crm/whatsapp - Get WhatsApp templates
export const GET = withAuth(
  async () => NextResponse.json(getWhatsAppTemplates()),
  { requireAll: ["crm:read"] },
);

// POST /api/v1/crm/whatsapp - Send a WhatsApp message
export const POST = withAuth(
  async (request, context) => {
    // Every send goes out from the business number and costs money, so meter it.
    const rateLimited = await checkTenantRateLimit(context.tenantId, 200, 20);
    if (rateLimited) return rateLimited;

    const data = await request.json().catch(() => null);
    const parsed = SendWhatsAppSchema.safeParse(data);

    if (!parsed.success) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const { to, body, templateName, templateParams, dealId, contactId } = parsed.data;

    try {
      const messageId = await sendWhatsAppMessage(
        {
          to,
          from: process.env.WHATSAPP_BUSINESS_NUMBER || "",
          body: body || "",
          templateName,
          templateParams,
          dealId,
          contactId,
        },
        process.env.WHATSAPP_API_KEY || "",
        process.env.WHATSAPP_API_URL || "",
      );

      if (dealId) {
        logWhatsAppToDeal(
          {
            id: messageId,
            to,
            from: process.env.WHATSAPP_BUSINESS_NUMBER || "",
            body: body || "",
            dealId,
            contactId,
            timestamp: new Date(),
          },
          dealId,
        );
      }

      return NextResponse.json({ messageId });
    } catch (error) {
      console.error("WhatsApp API error:", error);
      return NextResponse.json(
        { error: "Failed to send WhatsApp message" },
        { status: 500 },
      );
    }
  },
  { requireAll: ["crm:create"] },
);

// PATCH /api/v1/crm/whatsapp - Log a WhatsApp message to a deal
export const PATCH = withAuth(
  async (request) => {
    const data = await request.json().catch(() => null);
    const parsed = LogWhatsAppSchema.safeParse(data);

    if (!parsed.success) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const { messageId, dealId, contactId } = parsed.data;
    logWhatsAppToDeal(
      {
        id: messageId,
        to: "",
        from: "",
        body: "",
        dealId,
        contactId,
        timestamp: new Date(),
      },
      dealId,
    );

    return NextResponse.json({ success: true });
  },
  { requireAll: ["crm:update"] },
);
