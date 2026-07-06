"use strict";
import { processEmails } from "../../../../lib/ingestion/email";

/**
 * POST /api/ingestion/email
 * Triggers email ingestion pipeline
 */
export async function POST() {
    try {
        const results = await processEmails();
        return new Response(JSON.stringify(results), {
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