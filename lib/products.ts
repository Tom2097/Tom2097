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
    id: "starter",
    name: "Starter",
    description: "AI analytics for small teams getting started",
    priceInCents: 24900,
    annualPriceInCents: 19920,
    priceInr: 2099900,
    annualPriceInr: 1679900,
    interval: "month",
    features: [
      "1 workspace module",
      "Up to 5 team members",
      "1,000 AI actions/month",
      "Basic AI insights & alerts",
      "Core CRM",
      "Standard integrations",
      "Email support",
    ],
    limits: {
      users: 5,
      dataPoints: 100000,
      modules: 1,
      apiCalls: 1000,
    },
  },
  {
    id: "professional",
    name: "Professional",
    description: "The full platform with AI Intelligence brain for growing teams",
    priceInCents: 54900,
    annualPriceInCents: 43920,
    priceInr: 4599900,
    annualPriceInr: 3679900,
    interval: "month",
    features: [
      "3 workspace modules",
      "Up to 25 team members",
      "10,000 AI actions/month",
      "AI Intelligence: causal reasoning, daily briefings, predictions",
      "Full Smart CRM",
      "Workflow automation (all triggers)",
      "Semantic search",
      "Analytics & forecasting",
      "Integration Hub + API",
      "WhatsApp lead capture & nurture",
    ],
    limits: {
      users: 25,
      dataPoints: 1000000,
      modules: 3,
      apiCalls: 10000,
    },
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Scale, security, and autonomous agents for large organizations",
    priceInCents: 224900,
    annualPriceInCents: 179920,
    priceInr: 18999900,
    annualPriceInr: 15199900,
    interval: "month",
    features: [
      "All 4 workspace modules",
      "Unlimited team members (fair-use)",
      "Custom AI actions/month",
      "Autonomous AI agents & simulation",
      "Learns-your-business AI",
      "Full workflow + autonomous agents",
      "Custom integrations & webhooks",
      "Advanced RBAC + ABAC",
      "Audit & compliance (full export, DPDP data residency)",
      "SSO/SAML",
      "White-label",
      "On-premise / VPC (roadmap)",
    ],
    limits: {
      users: -1,
      dataPoints: -1,
      modules: 4,
      apiCalls: -1,
    },
  },
]

export function getPlanById(id: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === id)
}

/**
 * Reverse-lookup a plan id from a Stripe price id, using the same
 * STRIPE_PRICE_<PLAN> env var convention lib/billing/proration.ts uses to go
 * the other direction (plan id -> price id). Used by the Stripe webhook
 * handlers to figure out which plan a subscription.items[] price corresponds
 * to when Stripe itself (e.g. a billing-portal-driven plan change) is the
 * source of truth for what changed.
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
