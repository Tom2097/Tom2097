export interface SubscriptionPlan {
  id: string
  name: string
  description: string
  priceInCents: number
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
    description: "Perfect for small teams getting started with AI analytics",
    priceInCents: 29900, // $299/month
    interval: "month",
    features: [
      "1 industry module",
      "Up to 5 team members",
      "100K data points/month",
      "Email support",
      "Basic AI insights",
      "Standard reports",
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
    description: "For growing businesses that need advanced analytics",
    priceInCents: 99900, // $999/month
    interval: "month",
    features: [
      "3 industry modules",
      "Up to 25 team members",
      "1M data points/month",
      "API access",
      "Priority support",
      "Advanced AI predictions",
      "Custom dashboards",
      "Data export",
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
    description: "Full platform access with dedicated support",
    priceInCents: 499900, // $4,999/month
    interval: "month",
    features: [
      "All 6 industry modules",
      "Unlimited team members",
      "Unlimited data points",
      "Dedicated account manager",
      "24/7 phone support",
      "Custom AI model training",
      "White-label options",
      "SSO/SAML integration",
      "SLA guarantee",
      "On-premise deployment option",
    ],
    limits: {
      users: -1, // Unlimited
      dataPoints: -1, // Unlimited
      modules: 6,
      apiCalls: -1, // Unlimited
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
