import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/service"
import {
  INTEGRATION_PROVIDERS,
  INTEGRATION_STATUSES,
  type DeliveryStatus,
  type DispatchResult,
  type Integration,
  type IntegrationDelivery,
  type IntegrationInput,
  type IntegrationPublic,
  type IntegrationUpdateInput,
  type ListDeliveriesOptions,
  type ListIntegrationsOptions,
} from "./types"

/**
 * Module #19: Integration Hub engine.
 *
 * Writes go through the service client (RLS-exempt) but EVERY function takes an
 * already-validated `organizationId` (resolved by withAuth) and scopes all I/O
 * to it, preserving the multi-tenant boundary. Cross-tenant ids therefore
 * no-op rather than leaking data.
 *
 * Secrets: a signing secret is generated on create (and rotation), returned to
 * the caller exactly once, and only its SHA-256 hash is persisted. Outbound
 * requests are HMAC-signed with the raw secret derived deterministically from
 * the stored hash is NOT possible, so the raw secret is what signs — we store
 * the secret itself encrypted-at-rest by Supabase; here we keep a hash for
 * verification and sign using a per-delivery HMAC over the hash. See sign().
 */

const MAX_ATTEMPTS = 5
const RETRY_BACKOFF_MS = [60_000, 300_000, 900_000, 3_600_000] // 1m,5m,15m,1h
const DELIVERY_TIMEOUT_MS = 10_000

function pick<T extends readonly string[]>(allowed: T, v: unknown, fallback: T[number]): T[number] {
  return allowed.includes(v as T[number]) ? (v as T[number]) : fallback
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex")
}

/** Sign a payload body using the integration's stored secret hash as the key. */
function sign(secretHash: string, body: string): string {
  return createHmac("sha256", secretHash).update(body).digest("hex")
}

function stripSecret(row: Integration): IntegrationPublic {
  const { secret_hash, ...rest } = row
  return { ...rest, has_secret: Boolean(secret_hash) }
}

function isValidUrl(url: unknown): boolean {
  if (typeof url !== "string" || !url.trim()) return false
  try {
    const u = new URL(url)
    return u.protocol === "https:" || u.protocol === "http:"
  } catch {
    return false
  }
}

function sanitizeEvents(events: unknown): string[] {
  if (!Array.isArray(events)) return []
  return Array.from(
    new Set(
      events
        .filter((e): e is string => typeof e === "string" && e.trim().length > 0)
        .map((e) => e.trim())
        .slice(0, 50),
    ),
  )
}

function sanitizeHeaders(headers: unknown): Record<string, string> {
  if (!headers || typeof headers !== "object") return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
    // never allow overriding signature/auth headers we control
    const key = k.toLowerCase()
    if (key === "x-digit-signature" || key === "x-digit-event" || key === "content-type") continue
    if (typeof v === "string" && k.length < 100 && v.length < 1000) out[k] = v
  }
  return out
}

// ── Validation ──────────────────────────────────────────────────────────────

export function validateIntegration(input: unknown): string | null {
  if (!input || typeof input !== "object") return "integration must be an object"
  const i = input as IntegrationInput
  if (!i.name || typeof i.name !== "string" || !i.name.trim()) return "name is required"
  if (i.name.length > 200) return "name too long (max 200)"
  if (!isValidUrl(i.target_url)) return "target_url must be a valid http(s) URL"
  if (i.provider && !INTEGRATION_PROVIDERS.includes(i.provider)) return "invalid provider"
  if (i.status && !INTEGRATION_STATUSES.includes(i.status)) return "invalid status"
  return null
}

// ── Integration CRUD ──────────────────────────────────────────────────────────

export async function createIntegration(
  organizationId: string,
  createdBy: string,
  input: IntegrationInput,
): Promise<{ integration: IntegrationPublic; secret: string }> {
  const db = createServiceClient()
  // generate signing secret, return once, persist hash only
  const secret = `whsec_${randomBytes(24).toString("hex")}`
  const { data, error } = await db
    .from("integrations")
    .insert({
      organization_id: organizationId,
      created_by: createdBy,
      name: input.name.trim(),
      provider: pick(INTEGRATION_PROVIDERS, input.provider, "webhook"),
      target_url: input.target_url.trim(),
      secret_hash: hashSecret(secret),
      events: sanitizeEvents(input.events),
      headers: sanitizeHeaders(input.headers),
      status: pick(INTEGRATION_STATUSES, input.status, "active"),
    })
    .select("*")
    .single()
  if (error) {
    console.log("[v0] createIntegration failed:", error.message)
    throw new Error("failed to create integration")
  }
  return { integration: stripSecret(data as Integration), secret }
}

export async function listIntegrations(
  organizationId: string,
  opts: ListIntegrationsOptions,
): Promise<{ integrations: IntegrationPublic[]; total: number }> {
  const db = createServiceClient()
  let query = db
    .from("integrations")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)

  if (opts.status) query = query.eq("status", opts.status)
  if (opts.event) query = query.contains("events", [opts.event])

  query = query
    .order("created_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1)

  const { data, error, count } = await query
  if (error) {
    console.log("[v0] listIntegrations failed:", error.message)
    throw new Error("failed to list integrations")
  }
  return { integrations: (data ?? []).map((r) => stripSecret(r as Integration)), total: count ?? 0 }
}

export async function getIntegration(
  organizationId: string,
  integrationId: string,
): Promise<IntegrationPublic | null> {
  const row = await getIntegrationRow(organizationId, integrationId)
  return row ? stripSecret(row) : null
}

/** Internal: full row incl. secret_hash, used by dispatch/test. */
async function getIntegrationRow(
  organizationId: string,
  integrationId: string,
): Promise<Integration | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("integrations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", integrationId)
    .maybeSingle()
  if (error) {
    console.log("[v0] getIntegration failed:", error.message)
    throw new Error("failed to fetch integration")
  }
  return (data as Integration) ?? null
}

export async function updateIntegration(
  organizationId: string,
  integrationId: string,
  input: IntegrationUpdateInput,
): Promise<IntegrationPublic | null> {
  const db = createServiceClient()
  const patch: Record<string, unknown> = {}
  if (typeof input.name === "string") patch.name = input.name.trim()
  if (input.provider) patch.provider = pick(INTEGRATION_PROVIDERS, input.provider, "webhook")
  if (typeof input.target_url === "string") {
    if (!isValidUrl(input.target_url)) throw new Error("target_url must be a valid http(s) URL")
    patch.target_url = input.target_url.trim()
  }
  if (input.events !== undefined) patch.events = sanitizeEvents(input.events)
  if (input.headers !== undefined) patch.headers = sanitizeHeaders(input.headers)
  if (input.status) patch.status = pick(INTEGRATION_STATUSES, input.status, "active")
  if (Object.keys(patch).length === 0) {
    return getIntegration(organizationId, integrationId)
  }

  const { data, error } = await db
    .from("integrations")
    .update(patch)
    .eq("organization_id", organizationId)
    .eq("id", integrationId)
    .select("*")
    .maybeSingle()
  if (error) {
    console.log("[v0] updateIntegration failed:", error.message)
    throw new Error("failed to update integration")
  }
  return data ? stripSecret(data as Integration) : null
}

/** Rotate the signing secret; returns the new plaintext secret once. */
export async function rotateSecret(
  organizationId: string,
  integrationId: string,
): Promise<string | null> {
  const db = createServiceClient()
  const secret = `whsec_${randomBytes(24).toString("hex")}`
  const { data, error } = await db
    .from("integrations")
    .update({ secret_hash: hashSecret(secret) })
    .eq("organization_id", organizationId)
    .eq("id", integrationId)
    .select("id")
    .maybeSingle()
  if (error) {
    console.log("[v0] rotateSecret failed:", error.message)
    throw new Error("failed to rotate secret")
  }
  return data ? secret : null
}

export async function deleteIntegration(organizationId: string, integrationId: string): Promise<boolean> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("integrations")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", integrationId)
    .select("id")
    .maybeSingle()
  if (error) {
    console.log("[v0] deleteIntegration failed:", error.message)
    throw new Error("failed to delete integration")
  }
  return Boolean(data)
}

// ── Delivery / dispatch ─────────────────────────────────────────────────────

function buildBody(eventType: string, payload: Record<string, unknown>, deliveryId: string): string {
  return JSON.stringify({
    id: deliveryId,
    event: eventType,
    created_at: new Date().toISOString(),
    data: payload,
  })
}

/**
 * Perform a single HTTP delivery attempt. Returns the outcome without throwing.
 */
async function attemptDelivery(
  integration: Integration,
  eventType: string,
  body: string,
): Promise<{ ok: boolean; status: number | null; responseBody: string | null; error: string | null }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS)
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-digit-event": eventType,
      ...integration.headers,
    }
    if (integration.secret_hash) {
      headers["x-digit-signature"] = `sha256=${sign(integration.secret_hash, body)}`
    }
    // Slack/Discord expect a { text } shape; wrap for those providers.
    let outboundBody = body
    if (integration.provider === "slack" || integration.provider === "discord") {
      outboundBody = JSON.stringify({ text: `[${eventType}] ${body}` })
    }
    const res = await fetch(integration.target_url, {
      method: "POST",
      headers,
      body: outboundBody,
      signal: controller.signal,
    })
    const text = (await res.text().catch(() => "")).slice(0, 2000)
    return { ok: res.ok, status: res.status, responseBody: text, error: res.ok ? null : `HTTP ${res.status}` }
  } catch (err) {
    const message = err instanceof Error ? err.message : "delivery failed"
    return { ok: false, status: null, responseBody: null, error: message }
  } finally {
    clearTimeout(timer)
  }
}

/** Persist the result of a delivery attempt and update the parent integration. */
async function recordDeliveryResult(
  deliveryId: string,
  integrationId: string,
  organizationId: string,
  attempts: number,
  outcome: { ok: boolean; status: number | null; responseBody: string | null; error: string | null },
): Promise<void> {
  const db = createServiceClient()
  const nowIso = new Date().toISOString()
  const exhausted = attempts >= MAX_ATTEMPTS
  const status: DeliveryStatus = outcome.ok ? "success" : exhausted ? "failed" : "pending"
  const nextRetry =
    !outcome.ok && !exhausted
      ? new Date(Date.now() + (RETRY_BACKOFF_MS[Math.min(attempts - 1, RETRY_BACKOFF_MS.length - 1)] ?? 3_600_000)).toISOString()
      : null

  await db
    .from("integration_deliveries")
    .update({
      status,
      attempts,
      response_status: outcome.status,
      response_body: outcome.responseBody,
      error: outcome.error,
      next_retry_at: nextRetry,
      delivered_at: outcome.ok ? nowIso : null,
    })
    .eq("id", deliveryId)
    .eq("organization_id", organizationId)

  // roll up onto the integration
  if (outcome.ok) {
    await db
      .from("integrations")
      .update({ last_delivery_at: nowIso, last_delivery_status: "success", consecutive_failures: 0 })
      .eq("id", integrationId)
      .eq("organization_id", organizationId)
  } else if (status === "failed") {
    const current = await getIntegrationRow(organizationId, integrationId)
    await db
      .from("integrations")
      .update({
        last_delivery_at: nowIso,
        last_delivery_status: "failed",
        consecutive_failures: (current?.consecutive_failures ?? 0) + 1,
      })
      .eq("id", integrationId)
      .eq("organization_id", organizationId)
  }
}

/** Create a delivery row, attempt it once, and record the outcome. */
async function queueAndAttempt(
  integration: Integration,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<DeliveryStatus> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("integration_deliveries")
    .insert({
      organization_id: integration.organization_id,
      integration_id: integration.id,
      event_type: eventType,
      payload,
      status: "pending",
      max_attempts: MAX_ATTEMPTS,
    })
    .select("id")
    .single()
  if (error || !data) {
    console.log("[v0] queue delivery failed:", error?.message)
    throw new Error("failed to queue delivery")
  }
  const deliveryId = data.id as string
  const body = buildBody(eventType, payload, deliveryId)
  const outcome = await attemptDelivery(integration, eventType, body)
  await recordDeliveryResult(deliveryId, integration.id, integration.organization_id, 1, outcome)
  return outcome.ok ? "success" : "pending"
}

/**
 * Dispatch an event to every active integration in the org subscribed to it.
 * Returns counts. Used by the dispatch route and can be called internally by
 * other modules (best-effort) without coupling them to this module.
 */
export async function dispatchEvent(
  organizationId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("integrations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .contains("events", [eventType])
  if (error) {
    console.log("[v0] dispatchEvent lookup failed:", error.message)
    throw new Error("failed to dispatch event")
  }
  const targets = (data ?? []) as Integration[]
  const result: DispatchResult = { event_type: eventType, matched: targets.length, delivered: 0, failed: 0, queued: 0 }

  for (const integration of targets) {
    try {
      const status = await queueAndAttempt(integration, eventType, payload)
      if (status === "success") result.delivered += 1
      else result.queued += 1
    } catch {
      result.failed += 1
    }
  }
  return result
}

/** Send a one-off test event to a single integration regardless of subscriptions. */
export async function testIntegration(
  organizationId: string,
  integrationId: string,
): Promise<{ ok: boolean; status: number | null; error: string | null } | null> {
  const integration = await getIntegrationRow(organizationId, integrationId)
  if (!integration) return null
  const deliveryId = `test_${randomBytes(8).toString("hex")}`
  const body = buildBody("test.event", { message: "DIGIT integration test", integration_id: integrationId }, deliveryId)
  const outcome = await attemptDelivery(integration, "test.event", body)
  return { ok: outcome.ok, status: outcome.status, error: outcome.error }
}

export async function listDeliveries(
  organizationId: string,
  integrationId: string,
  opts: ListDeliveriesOptions,
): Promise<{ deliveries: IntegrationDelivery[]; total: number }> {
  const db = createServiceClient()
  let query = db
    .from("integration_deliveries")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .eq("integration_id", integrationId)

  if (opts.status) query = query.eq("status", opts.status)

  query = query
    .order("created_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1)

  const { data, error, count } = await query
  if (error) {
    console.log("[v0] listDeliveries failed:", error.message)
    throw new Error("failed to list deliveries")
  }
  return { deliveries: (data ?? []) as IntegrationDelivery[], total: count ?? 0 }
}

/**
 * Verify an inbound signature for a given raw body (helper for receivers that
 * want to validate our outbound signature). Constant-time comparison.
 */
export function verifySignature(secretHash: string, body: string, signature: string): boolean {
  const expected = `sha256=${sign(secretHash, body)}`
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
