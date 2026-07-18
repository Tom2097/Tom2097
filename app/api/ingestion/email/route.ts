"use strict";
import type { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { processEmails } from "../../../../lib/ingestion/email";

/**
 * POST /api/ingestion/email
 * Triggers email ingestion pipeline
 */
export async function POST(request: NextRequest) {
    if (!isAuthorizedCronRequest(request)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // This legacy pipeline still uses placeholder IMAP data. Never fabricate
    // ingestion results in a production environment.
    if (process.env.NODE_ENV === "production") {
        return Response.json({ error: "Legacy email ingestion is disabled" }, { status: 503 });
    }

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
