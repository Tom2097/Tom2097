"use strict";
import { handleWhatsAppWebhook } from "../../../../lib/ingestion/whatsapp";

/**
 * POST /api/ingestion/whatsapp
 * Handles WhatsApp webhook for message ingestion
 */
export async function POST(request: Request) {
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