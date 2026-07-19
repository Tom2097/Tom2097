import { createServiceClient } from "@/lib/supabase/service"

export interface DiscountConfig {
  code: string
  type: "percentage" | "fixed"
  value: number
  maxUses: number
  currentUses: number
  expiresAt: string | null
  minPlanId?: string
}

interface DiscountCodeRow {
  code: string
  discount_type: "percentage" | "fixed"
  value: number
  max_uses: number
  current_uses: number
  expires_at: string | null
  min_plan_id: string | null
}

function rowToDiscountConfig(row: DiscountCodeRow): DiscountConfig {
  return {
    code: row.code,
    type: row.discount_type,
    value: row.value,
    maxUses: row.max_uses,
    currentUses: row.current_uses,
    expiresAt: row.expires_at,
    minPlanId: row.min_plan_id ?? undefined,
  }
}

/**
 * Read-only validation against the discount_codes table (supabase/migrations/
 * 20260718090000_discount_redemptions.sql). This does NOT consume a
 * redemption -- it's safe to call whenever a user types a code in at
 * checkout time. Use recordDiscountUse() to atomically claim a redemption
 * once payment is confirmed.
 */
export async function validateDiscountCode(
  code: string,
  planId: string
): Promise<{ valid: boolean; discount?: DiscountConfig; error?: string }> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("discount_codes")
    .select("code, discount_type, value, max_uses, current_uses, expires_at, min_plan_id")
    .eq("code", code.toUpperCase())
    .maybeSingle()

  if (error) {
    console.error("[v0] validateDiscountCode lookup error:", error.message)
    return { valid: false, error: "Could not validate discount code" }
  }

  if (!data) return { valid: false, error: "Invalid discount code" }

  const discount = rowToDiscountConfig(data as DiscountCodeRow)

  if (discount.currentUses >= discount.maxUses) return { valid: false, error: "Discount code has expired" }
  if (discount.expiresAt && new Date(discount.expiresAt) < new Date()) return { valid: false, error: "Discount code has expired" }
  if (discount.minPlanId) {
    const planPriority = ["starter", "professional", "enterprise"]
    if (planPriority.indexOf(planId) < planPriority.indexOf(discount.minPlanId)) {
      return { valid: false, error: "Discount not available for this plan" }
    }
  }
  return { valid: true, discount }
}

export function applyDiscount(priceInCents: number, discount: DiscountConfig): number {
  if (discount.type === "percentage") {
    return Math.round(priceInCents * (1 - discount.value / 100))
  }
  return Math.max(0, priceInCents - discount.value * 100)
}

/**
 * Atomically claims one redemption of `code` for `organizationId` via the
 * redeem_discount_code() RPC, which increments current_uses only if the
 * code is still under max_uses (single UPDATE ... WHERE, race-safe across
 * concurrent callers). Call this ONLY once a payment is actually confirmed
 * (the Stripe webhook's checkout.session.completed handler) -- never before
 * checkout, or an abandoned checkout would burn a redemption for nothing.
 *
 * `sessionId`, when provided (the Stripe checkout session id), is logged in
 * discount_redemptions with a unique constraint so a duplicate webhook
 * delivery for the same session can never double-claim.
 */
export async function recordDiscountUse(
  code: string,
  organizationId: string,
  sessionId?: string | null
): Promise<{ claimed: boolean; discount?: DiscountConfig }> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc("redeem_discount_code", {
    p_code: code,
    p_organization_id: organizationId,
    p_session_id: sessionId ?? null,
  })

  if (error) {
    console.error("[v0] recordDiscountUse RPC error:", error.message)
    return { claimed: false }
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { claimed: false }

  return {
    claimed: true,
    discount: rowToDiscountConfig({
      code: row.code,
      discount_type: row.discount_type,
      value: row.value,
      max_uses: 0,
      current_uses: 0,
      expires_at: null,
      min_plan_id: row.min_plan_id,
    }),
  }
}

export async function getFoundingDiscountEligibility(
  tierId: string
): Promise<{ eligible: boolean; discount?: DiscountConfig }> {
  const code = tierId === "professional" ? "FOUNDER30" : tierId === "enterprise" ? "FOUNDER40" : null
  if (!code) return { eligible: false }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("discount_codes")
    .select("code, discount_type, value, max_uses, current_uses, expires_at, min_plan_id")
    .eq("code", code)
    .maybeSingle()

  if (error || !data) return { eligible: false }

  const discount = rowToDiscountConfig(data as DiscountCodeRow)
  if (discount.currentUses < discount.maxUses) {
    return { eligible: true, discount }
  }
  return { eligible: false }
}
