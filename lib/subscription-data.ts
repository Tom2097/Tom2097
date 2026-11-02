import { SUBSCRIPTION_PLANS } from "./products"

export interface PricingTier {
  id: string
  name: string
  description: string
  monthlyPrice: number
  annualPrice: number
  features: string[]
  limits: {
    users: number | "unlimited"
    dataPoints: string
    modules: number | "all"
    apiCalls: string
  }
  highlighted?: boolean
  cta: string
}

export interface AddOn {
  id: string
  name: string
  description: string
  price: number
  unit: string
}

// Derived from each plan's own limits (-1 = unlimited). This used to switch
// on the old starter/professional/enterprise ids, so the current single plan
// fell through to a placeholder of 1 user / 1 module.
export const pricingTiers: PricingTier[] = SUBSCRIPTION_PLANS.map((plan) => ({
  id: plan.id,
  name: plan.name,
  description: plan.description,
  monthlyPrice: plan.priceInCents / 100,
  annualPrice: plan.annualPriceInCents / 100,
  features: plan.features,
  limits: {
    users: plan.limits.users < 0 ? "unlimited" : plan.limits.users,
    dataPoints: plan.limits.dataPoints < 0 ? "Unlimited" : plan.limits.dataPoints.toLocaleString("en-US"),
    modules: plan.limits.modules < 0 || plan.limits.modules >= 6 ? "all" : plan.limits.modules,
    apiCalls: plan.limits.apiCalls < 0 ? "Unlimited" : `${plan.limits.apiCalls.toLocaleString("en-US")}/month`,
  },
  highlighted: plan.popular,
  cta: "Start free trial",
}))

export interface CurrencyConfig {
  code: string
  symbol: string
  label: string
  gstRate?: number
}

export const currencies: CurrencyConfig[] = [
  { code: "USD", symbol: "$", label: "USD" },
  { code: "INR", symbol: "₹", label: "INR", gstRate: 18 },
]

export const inrPrices: Record<string, { monthly: number; annual: number }> = {
  starter: { monthly: 3499, annual: 34999 },
  professional: { monthly: 14999, annual: 149999 },
  enterprise: { monthly: 100000, annual: 1000000 },
}

export const addOns: AddOn[] = [
  {
    id: "ai-credits",
    name: "AI Credits Pack",
    description: "Additional AI queries and predictions",
    price: 99,
    unit: "10,000 credits"
  },
  {
    id: "extra-users",
    name: "Additional Users",
    description: "Add more team members to your plan",
    price: 29,
    unit: "per user/month"
  },
  {
    id: "data-connector",
    name: "Premium Connector",
    description: "Salesforce, SAP, Oracle, or HubSpot integration",
    price: 199,
    unit: "per connector/month"
  },
  {
    id: "dedicated-support",
    name: "Dedicated Support",
    description: "24/7 phone support with 1-hour response time",
    price: 499,
    unit: "per month"
  }
]

export const platformModules = [
  { id: "analytics", name: "AI Analytics", icon: "BarChart3" },
  { id: "crm", name: "CRM Intelligence", icon: "Users" },
  { id: "operations", name: "Operations Workspace", icon: "LayoutGrid" },
  { id: "performance", name: "Performance Workspace", icon: "Activity" },
  { id: "resources", name: "Resource Workspace", icon: "Boxes" },
  { id: "compliance", name: "Compliance Workspace", icon: "ShieldCheck" }
]
