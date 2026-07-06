"use server"

import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logging"

interface AuditLogData {
  [key: string]: string | number | boolean | object | null | undefined
}

/**
 * Log an audit event for tracking user actions and system events
 */
export async function logAuditEvent(
  userId: string,
  context: string,
  action: string,
  data: AuditLogData = {}
) {
  const db = createServiceClient()

  try {
    const { error } = await db.from("audit_logs").insert({
      user_id: userId,
      context,
      action,
      data: JSON.stringify(data),
      ip_address: "0.0.0.0", // In a real app, this would be dynamically set
      user_agent: "onboarding-flow", // In a real app, this would be dynamically set
      created_at: new Date().toISOString()
    })

    if (error) throw error
  } catch (err) {
    logger.logError("[audit] Failed to log event:", { error: err, userId, context, action })
  }
}