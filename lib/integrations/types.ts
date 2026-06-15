/**
 * Module #19: Integration Hub — shared types.
 *
 * OUTBOUND third-party connections (distinct from Module #6 inbound workflow
 * webhooks). An integration subscribes to event types; when an event is
 * dispatched, an HMAC-signed delivery is queued per matching integration and
 * recorded in integration_deliveries with retry support.
 *
 * The engine uses the service-role client (manual org scoping) and can be
 * driven by a cron via the service-role-only get_pending_integration_deliveries().
 */

export const INTEGRATION_PROVIDERS = ["webhook", "slack", "discord", "http"] as const
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number]

export const INTEGRATION_STATUSES = ["active", "paused", "disabled"] as const
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number]

export const DELIVERY_STATUSES = ["pending", "success", "failed"] as const
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

/**
 * Known event types an integration may subscribe to. This is intentionally a
 * permissive string at the DB layer; the catalog documents the supported set
 * without coupling to any single module.
 */
export const INTEGRATION_EVENT_TYPES = [
  "feedback.created",
  "feedback.status_changed",
  "document.uploaded",
  "report.generated",
  "incident.created",
  "incident.resolved",
  "monitor.checked",
  "test.event",
] as const
export type IntegrationEventType = (typeof INTEGRATION_EVENT_TYPES)[number]

export interface Integration {
  id: string
  organization_id: string
  name: string
  provider: IntegrationProvider
  target_url: string
  /** Never returned to clients; presence is surfaced via `has_secret`. */
  secret_hash: string | null
  events: string[]
  headers: Record<string, string>
  status: IntegrationStatus
  last_delivery_at: string | null
  last_delivery_status: "success" | "failed" | null
  consecutive_failures: number
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Public-facing shape: secret_hash stripped, replaced with has_secret. */
export type IntegrationPublic = Omit<Integration, "secret_hash"> & { has_secret: boolean }

export interface IntegrationInput {
  name: string
  provider?: IntegrationProvider
  target_url: string
  events?: string[]
  headers?: Record<string, string>
  status?: IntegrationStatus
}

export interface IntegrationUpdateInput {
  name?: string
  provider?: IntegrationProvider
  target_url?: string
  events?: string[]
  headers?: Record<string, string>
  status?: IntegrationStatus
}

export interface IntegrationDelivery {
  id: string
  organization_id: string
  integration_id: string
  event_type: string
  payload: Record<string, unknown>
  status: DeliveryStatus
  attempts: number
  max_attempts: number
  response_status: number | null
  response_body: string | null
  error: string | null
  next_retry_at: string | null
  delivered_at: string | null
  created_at: string
}

export interface ListIntegrationsOptions {
  limit?: number
  offset?: number
  status?: IntegrationStatus
  event?: string
}

export interface ListDeliveriesOptions {
  limit?: number
  offset?: number
  status?: DeliveryStatus
}

/** Result of a dispatch call: how many deliveries were queued/sent. */
export interface DispatchResult {
  event_type: string
  matched: number
  delivered: number
  failed: number
  queued: number
}
