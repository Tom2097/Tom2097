// Pricing & Payments Build Spec v1.0: a single all-inclusive product,
// replacing the old starter/professional/enterprise tiers (clean cutover --
// no real customers were on the old model). The SubscriptionPlan shape and
// exported helpers are kept identical to what they were so every existing
// consumer (checkout, entitlements, revenue analytics, signup, the
// Stripe/Razorpay webhooks) keeps compiling against a catalog that now just
// happens to have one entry.
//
// The ACTUAL price a given org pays is never read from this catalog at
// charge time -- it's locked on subscriptions.locked_price_cents at
// confirmation (see lib/billing/signup.ts), exactly as the spec requires
// ("never recompute the price at charge time from a live counter"). This
// file only holds the two public price points and the constants that
// depend on them.

export const LIST_PRICE_CENTS = 1_300_000 // USD 13,000/year, public list price -- never changes publicly
export const FOUNDING_PRICE_CENTS = 1_000_000 // USD 10,000/year, first 50 customers, locked for as long as they stay
export const FOUNDING_SLOT_COUNT = 50
export const FOUNDING_TRIAL_DAYS = 60 // 2 months
export const STANDARD_TRIAL_DAYS = 30 // 1 month
export const INSTALMENT_COUNT = 12

// FX-derived placeholder (13,000 * ~83), NOT a confirmed real INR price --
// the spec assumes a single USD price worldwide and flags regional pricing
// as an open question (Section 7, #8). Razorpay (kept for Indian domestic
// collection per the spec's own provider recommendation) needs SOME INR
// number to charge; this is here so that path doesn't hard-fail, but it
// needs a real decision before it's trusted for actual invoicing.
export const LIST_PRICE_INR_PAISE = 107_900_000 // ~INR 10,79,000 -- PLACEHOLDER, confirm real price
export const FOUNDING_PRICE_INR_PAISE = 83_000_000 // ~INR 8,30,000 -- PLACEHOLDER, confirm real price

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
    priceInCents: LIST_PRICE_CENTS,
    annualPriceInCents: LIST_PRICE_CENTS,
    priceInr: LIST_PRICE_INR_PAISE,
    annualPriceInr: LIST_PRICE_INR_PAISE,
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
  }).format(cents / 100)
}

export function formatInrPrice(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100)
}
