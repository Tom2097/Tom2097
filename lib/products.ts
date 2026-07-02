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
    priceInCents: 9900,
    annualPriceInCents: 8300,
    priceInr: 349900,
    annualPriceInr: 291500,
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
    priceInCents: 39900,
    annualPriceInCents: 33200,
    priceInr: 1499900,
    annualPriceInr: 1249900,
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
      "Priority support + onboarding",
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
    priceInCents: 149900,
    annualPriceInCents: 124900,
    priceInr: 10000000,
    annualPriceInr: 8330000,
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
      "Dedicated CSM, SLA response",
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
