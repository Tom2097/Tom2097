"use server";

import { NextResponse } from "next/server";
import { z } from "zod";
import { sendWhatsAppMessage, logWhatsAppToDeal, getWhatsAppTemplates } from "../../../../../lib/crm/whatsapp";

// Schema for sending WhatsApp message
const SendWhatsAppSchema = z.object({
  to: z.string(),
  body: z.string().optional(),
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

// GET /api/v1/crm/whatsapp/templates - Get WhatsApp templates
export async function GET() {
  const templates = getWhatsAppTemplates();
  return NextResponse.json(templates);
}

// POST /api/v1/crm/whatsapp/send - Send a WhatsApp message
export async function POST(request: Request) {
  const data = await request.json();
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
}

// POST /api/v1/crm/whatsapp/log - Log a WhatsApp message to a deal
export async function PATCH(request: Request) {
  const data = await request.json();
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
}