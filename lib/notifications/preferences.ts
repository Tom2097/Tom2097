import { createServiceClient } from "@/lib/supabase/service"
import { CHANNELS, type Channel, type NotificationPreference } from "./types"

/**
 * Module #8: Notification preferences store.
 *
 * Preferences are an opt-out model: the absence of a row means the channel is
 * enabled for that category. All reads/writes are scoped to org + user.
 */

export interface PreferenceInput {
  category: string
  channel: Channel
  enabled: boolean
}

export function validatePreference(input: unknown): string | null {
  if (!input || typeof input !== "object") return "preference must be an object"
  const p = input as PreferenceInput
  if (!p.category || typeof p.category !== "string" || !p.category.trim()) {
    return "category is required"
  }
  if (!CHANNELS.includes(p.channel)) return `channel must be one of: ${CHANNELS.join(", ")}`
  if (typeof p.enabled !== "boolean") return "enabled must be a boolean"
  return null
}

export async function listPreferences(
  organizationId: string,
  userId: string,
): Promise<NotificationPreference[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("notification_preferences")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("category", { ascending: true })
  if (error) {
    console.log("[v0] listPreferences failed:", error.message)
    throw new Error("failed to list preferences")
  }
  return (data ?? []) as NotificationPreference[]
}

/**
 * Upsert one or more preference rows for a user. Uses the (user_id, category,
 * channel) unique constraint so repeated calls toggle the same row.
 */
export async function upsertPreferences(
  organizationId: string,
  userId: string,
  prefs: PreferenceInput[],
): Promise<NotificationPreference[]> {
  if (prefs.length === 0) return []
  const db = createServiceClient()
  const rows = prefs.map((p) => ({
    organization_id: organizationId,
    user_id: userId,
    category: p.category.trim(),
    channel: p.channel,
    enabled: p.enabled,
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await db
    .from("notification_preferences")
    .upsert(rows, { onConflict: "user_id,category,channel" })
    .select("*")
  if (error) {
    console.log("[v0] upsertPreferences failed:", error.message)
    throw new Error("failed to update preferences")
  }
  return (data ?? []) as NotificationPreference[]
}
