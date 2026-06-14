import { createServiceClient } from "@/lib/supabase/service"
import {
  CHANNELS,
  NOTIFICATION_TYPES,
  PRIORITIES,
  SOURCES,
  type BroadcastInput,
  type Channel,
  type ListOptions,
  type Notification,
  type NotificationInput,
  type NotificationType,
  type Priority,
  type Source,
} from "./types"

/**
 * Module #8: Notification engine.
 *
 * Writes go through the service client (RLS-exempt) but EVERY function takes an
 * already-validated `organizationId` (resolved by withAuth) and scopes all I/O
 * to it, preserving the multi-tenant boundary. Reads from API routes use the
 * user's RLS-bound client where possible; the service-client reads here are
 * always filtered by organization_id + user_id.
 *
 * Delivery honors per-user, per-category in_app preferences: a recipient who
 * disabled a category's in_app channel is skipped. Missing preference rows mean
 * "enabled" (opt-out model).
 */

const MAX_BROADCAST = 5000

function pick<T extends readonly string[]>(allowed: T, v: unknown, fallback: T[number]): T[number] {
  return allowed.includes(v as T[number]) ? (v as T[number]) : fallback
}

/** Validate a notification payload (shared by single + broadcast). */
export function validateNotification(input: unknown, requireUser: boolean): string | null {
  if (!input || typeof input !== "object") return "notification must be an object"
  const n = input as NotificationInput
  if (requireUser && (!n.user_id || typeof n.user_id !== "string")) return "user_id is required"
  if (!n.title || typeof n.title !== "string" || !n.title.trim()) return "title is required"
  if (n.title.length > 300) return "title too long (max 300)"
  if (n.body != null && typeof n.body !== "string") return "body must be a string"
  if (n.action_url != null && typeof n.action_url !== "string") return "action_url must be a string"
  if (n.data != null && typeof n.data !== "object") return "data must be an object"
  if (n.expires_at != null && Number.isNaN(Date.parse(n.expires_at))) {
    return "expires_at must be an ISO date string"
  }
  return null
}

interface NormalizedRow {
  type: NotificationType
  category: string
  priority: Priority
  title: string
  body: string | null
  action_url: string | null
  data: Record<string, unknown>
  source: Source
  expires_at: string | null
}

function normalize(input: NotificationInput | BroadcastInput): NormalizedRow {
  return {
    type: pick(NOTIFICATION_TYPES, input.type, "info"),
    category: (input.category ?? "general").trim() || "general",
    priority: pick(PRIORITIES, input.priority, "normal"),
    title: input.title.trim(),
    body: input.body?.trim() || null,
    action_url: input.action_url ?? null,
    data: input.data ?? {},
    source: pick(SOURCES, input.source, "app"),
    expires_at: input.expires_at ?? null,
  }
}

/**
 * Return the subset of recipients who have the in_app channel enabled for the
 * given category. Opt-out model: only users with an explicit enabled=false row
 * for (category, in_app) are excluded.
 */
async function filterByPreference(
  organizationId: string,
  userIds: string[],
  category: string,
): Promise<string[]> {
  if (userIds.length === 0) return []
  const db = createServiceClient()
  const { data, error } = await db
    .from("notification_preferences")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("category", category)
    .eq("channel", "in_app")
    .eq("enabled", false)
    .in("user_id", userIds)
  if (error) {
    console.log("[v0] filterByPreference failed:", error.message)
    return userIds // fail open: deliver rather than silently drop
  }
  const disabled = new Set((data ?? []).map((r: { user_id: string }) => r.user_id))
  return userIds.filter((id) => !disabled.has(id))
}

/** Create a single notification for one recipient. Returns the row, or null if suppressed by preference. */
export async function createNotification(
  organizationId: string,
  input: NotificationInput,
): Promise<Notification | null> {
  const base = normalize(input)
  const allowed = await filterByPreference(organizationId, [input.user_id], base.category)
  if (allowed.length === 0) return null

  const db = createServiceClient()
  const { data, error } = await db
    .from("notifications")
    .insert({ organization_id: organizationId, user_id: input.user_id, ...base })
    .select("*")
    .single()
  if (error) {
    console.log("[v0] createNotification failed:", error.message)
    throw new Error("failed to create notification")
  }
  return data as Notification
}

/**
 * Broadcast a notification to many recipients. If `userIds` is omitted, all
 * members of the organization (from public.profiles) receive it. Returns the
 * number of rows actually delivered (after preference filtering).
 */
export async function broadcast(
  organizationId: string,
  input: BroadcastInput,
  userIds?: string[],
): Promise<{ delivered: number }> {
  const base = normalize(input)
  const db = createServiceClient()

  let recipients = userIds
  if (!recipients) {
    const { data, error } = await db
      .from("profiles")
      .select("id")
      .eq("organization_id", organizationId)
    if (error) {
      console.log("[v0] broadcast recipient lookup failed:", error.message)
      throw new Error("failed to resolve recipients")
    }
    recipients = (data ?? []).map((r: { id: string }) => r.id)
  }

  if (recipients.length > MAX_BROADCAST) {
    throw new Error(`too many recipients (max ${MAX_BROADCAST})`)
  }

  const allowed = await filterByPreference(organizationId, recipients, base.category)
  if (allowed.length === 0) return { delivered: 0 }

  const rows = allowed.map((uid) => ({
    organization_id: organizationId,
    user_id: uid,
    ...base,
  }))

  const { error } = await db.from("notifications").insert(rows)
  if (error) {
    console.log("[v0] broadcast insert failed:", error.message)
    throw new Error("failed to broadcast notification")
  }
  return { delivered: rows.length }
}

/** List a user's notifications, newest first. Always scoped to org + user. */
export async function listNotifications(
  organizationId: string,
  userId: string,
  opts: ListOptions,
): Promise<{ notifications: Notification[]; total: number }> {
  const db = createServiceClient()
  let query = db
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1)

  if (opts.unreadOnly) query = query.is("read_at", null)
  if (opts.category) query = query.eq("category", opts.category)

  const { data, error, count } = await query
  if (error) {
    console.log("[v0] listNotifications failed:", error.message)
    throw new Error("failed to list notifications")
  }
  return { notifications: (data ?? []) as Notification[], total: count ?? 0 }
}

export async function getUnreadCount(organizationId: string, userId: string): Promise<number> {
  const db = createServiceClient()
  const { data, error } = await db.rpc("notification_unread_count", {
    p_org: organizationId,
    p_user: userId,
  })
  if (error) {
    console.log("[v0] getUnreadCount failed:", error.message)
    throw new Error("failed to get unread count")
  }
  return Number(data ?? 0)
}

/** Mark one notification read. Scoped to org + user so cross-tenant ids no-op. */
export async function markRead(
  organizationId: string,
  userId: string,
  notificationId: string,
): Promise<boolean> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("id", notificationId)
    .is("read_at", null)
    .select("id")
  if (error) {
    console.log("[v0] markRead failed:", error.message)
    throw new Error("failed to mark notification read")
  }
  return (data ?? []).length > 0
}

/** Mark all of a user's unread notifications read. Returns count updated. */
export async function markAllRead(organizationId: string, userId: string): Promise<number> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .is("read_at", null)
    .select("id")
  if (error) {
    console.log("[v0] markAllRead failed:", error.message)
    throw new Error("failed to mark all read")
  }
  return (data ?? []).length
}

export async function deleteNotification(
  organizationId: string,
  userId: string,
  notificationId: string,
): Promise<boolean> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("notifications")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("id", notificationId)
    .select("id")
  if (error) {
    console.log("[v0] deleteNotification failed:", error.message)
    throw new Error("failed to delete notification")
  }
  return (data ?? []).length > 0
}

export { CHANNELS }
export type { Channel }
