// A single all-inclusive product, sold either annually or month-to-month --
// replacing the old starter/professional/enterprise tiers AND the later
// $13,000/$10,000-founding-tier annual-only model (clean re-price both
// times: no real customers were ever on either old model -- verified
// directly against production, zero subscriptions rows have a
// stripe_subscription_id or locked_price_cents set). The SubscriptionPlan
// shape and exported helpers are kept identical to what they were so every
// existing consumer (checkout, entitlements, revenue analytics, signup, the
// Stripe/Razorpay webhooks) keeps compiling against a catalog that still
// happens to have one entry.
//
// The ACTUAL price a given org pays is never read from this catalog at
// charge time -- it's locked on subscriptions.locked_price_cents at
// confirmation (see lib/billing/signup.ts), so a future price change here
// never retroactively changes what an existing subscriber owes.

export const ANNUAL_PRICE_CENTS = 49_900 // USD 499/year
export const MONTHLY_PRICE_CENTS = 4_449 // USD 44.49/month, cancel anytime
export const STANDARD_TRIAL_DAYS = 30 // 1 month, both intervals

// FX-derived placeholder (499 * ~83), NOT a confirmed real INR price.
// Razorpay (kept for Indian domestic collection) needs SOME INR number to
// charge; this is here so that path doesn't hard-fail, but it needs a real
// decision before it's trusted for actual invoicing.
export const ANNUAL_PRICE_INR_PAISE = 4_141_700 // ~INR 41,417 -- PLACEHOLDER, confirm real price

export interface SubscriptionPlan {
  id: string
  name: string
  description: string
  priceInCents: number
  annualPriceInCents: number
  priceInr: number
  annualPriceInr: number
  interval: "month" | "year"
  features: string[]
  limits: {
    users: number
    dataPoints: number
    modules: number
    apiCalls: number
  }
  popular?: boolean
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "digit_annual",
    name: "DigiT",
    description: "The full platform, every module, every AI capability, one price.",
    priceInCents: MONTHLY_PRICE_CENTS,
    annualPriceInCents: ANNUAL_PRICE_CENTS,
    priceInr: ANNUAL_PRICE_INR_PAISE,
    annualPriceInr: ANNUAL_PRICE_INR_PAISE,
    interval: "year",
    features: [
      "All 6 workspace modules",
      "Unlimited team members (fair-use)",
      "AI Intelligence: causal reasoning, daily briefings, predictions",
      "Autonomous AI agents & simulation",
      "Full Smart CRM + workflow automation",
      "Human-in-the-loop approvals & audit trail",
      "Semantic search, analytics & forecasting",
      "Integration Hub + API",
      "Advanced RBAC + ABAC",
      "Audit & compliance (full export, DPDP data residency)",
      "SSO/SAML",
    ],
    limits: {
      users: -1,
      dataPoints: -1,
      modules: 6,
      apiCalls: -1,
    },
  },
]

export function getPlanById(id: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === id)
}

/**
 * Validates an untrusted, caller-supplied plan id against the real plan
 * catalog, falling back to the single real plan rather than trusting it
 * blindly. Kept even though there's only one plan now -- signup/callback
 * still thread a plan id through from old links/bookmarks, and this is
 * what makes those harmlessly resolve to the one real product instead of
 * erroring.
 */
export function getValidatedPlanId(id: unknown, fallback = "digit_annual"): string {
  return typeof id === "string" && getPlanById(id) ? id : fallback
}

/**
 * Reverse-lookup a plan id from a Stripe price id. Unused by the new
 * signup flow (which uses price_data / PaymentIntents directly, not
 * pre-created Stripe Price objects), kept for the old webhook code paths
 * that still reference it.
 */
export function getPlanIdFromStripePriceId(priceId: string | null | undefined): string | undefined {
  if (!priceId) return undefined
  return SUBSCRIPTION_PLANS.find(
    (plan) => process.env[`STRIPE_PRICE_${plan.id.toUpperCase()}`] === priceId
  )?.id
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function formatInrPrice(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100)
}
