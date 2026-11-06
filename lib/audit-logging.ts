"use server"

import { isIP } from "net"
import { headers } from "next/headers"
import { getClientIp } from "@/lib/auth/audit"
import { getAuthenticatedUser } from "@/lib/auth/server-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logging"

interface AuditLogData {
  [key: string]: string | number | boolean | object | null | undefined
}

const MAX_METADATA_CHARS = 8_000

/**
 * Log an audit event for tracking user actions and system events.
 *
 * This is a Server Action, so its arguments come from the browser. The actor is
 * always the session user, and `client_reported` marks the event text as the
 * client's own claim rather than a server-verified fact. Calls without a session
 * (early onboarding stages) only reach the server log, so anonymous visitors
 * cannot write to the audit table.
 */
export async function logAuditEvent(
  _userId: string,
  context: string,
  action: string,
  data: AuditLogData = {}
) {
  const event = String(action).slice(0, 120)
  const resourceType = String(context).slice(0, 60)

  let user: Awaited<ReturnType<typeof getAuthenticatedUser>>
  try {
    user = await getAuthenticatedUser()
  } catch {
    logger.logInfo("[audit] Unauthenticated client event:", { context: resourceType, action: event })
    return
  }

  try {
    const db = createServiceClient()
    const { data: profile } = await db
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle()

    const ip = getClientIp(await headers())
    const serialized = JSON.stringify(data) ?? "{}"
    const details = serialized.length > MAX_METADATA_CHARS ? { truncated: true } : data

    const { error } = await db.from("audit_logs").insert({
      user_id: user.id,
      organization_id: profile?.organization_id ?? null,
      action: event,
      resource_type: resourceType,
      metadata: { ...details, client_reported: true },
      ip_address: ip && isIP(ip) ? ip : null,
    })

    if (error) throw error
  } catch (err) {
    logger.logError("[audit] Failed to log event:", { error: err, userId: user.id, context: resourceType, action: event })
  }
}
