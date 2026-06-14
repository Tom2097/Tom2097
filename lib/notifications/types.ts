/**
 * Module #8: Notification System — shared types.
 *
 * Mirrors the public.notifications and public.notification_preferences tables.
 * Channels are extensible; only in_app is delivered synchronously today. The
 * email channel is represented in preferences so future delivery can honor it
 * without a schema change.
 */

export const NOTIFICATION_TYPES = ["info", "success", "warning", "error", "system"] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const
export type Priority = (typeof PRIORITIES)[number]

export const CHANNELS = ["in_app", "email"] as const
export type Channel = (typeof CHANNELS)[number]

export const SOURCES = ["app", "workflow", "system", "api"] as const
export type Source = (typeof SOURCES)[number]

export interface Notification {
  id: string
  organization_id: string
  user_id: string
  type: NotificationType
  category: string
  priority: Priority
  title: string
  body: string | null
  action_url: string | null
  data: Record<string, unknown>
  source: Source
  read_at: string | null
  created_at: string
  expires_at: string | null
}

/** Input accepted when creating a notification for a single recipient. */
export interface NotificationInput {
  user_id: string
  title: string
  type?: NotificationType
  category?: string
  priority?: Priority
  body?: string | null
  action_url?: string | null
  data?: Record<string, unknown>
  source?: Source
  expires_at?: string | null
}

/** Input accepted when broadcasting to many recipients (no user_id). */
export type BroadcastInput = Omit<NotificationInput, "user_id">

export interface NotificationPreference {
  id: string
  organization_id: string
  user_id: string
  category: string
  channel: Channel
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface ListOptions {
  limit: number
  offset: number
  unreadOnly: boolean
  category: string | null
}
