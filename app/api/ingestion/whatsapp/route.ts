"use strict";
import type { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { handleWhatsAppWebhook } from "../../../../lib/ingestion/whatsapp";

/**
 * POST /api/ingestion/whatsapp
 * Handles WhatsApp webhook for message ingestion
 */
export async function POST(request: NextRequest) {
    if (!isAuthorizedCronRequest(request)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // The handler below is a legacy mock. The signed Meta webhook lives at
    // /api/v1/operations/whatsapp-webhook.
    if (process.env.NODE_ENV === "production") {
        return Response.json({ error: "Legacy WhatsApp ingestion is disabled" }, { status: 503 });
    }

    try {
        const message = await request.json();
        const result = await handleWhatsAppWebhook(message);
        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: String(error) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
