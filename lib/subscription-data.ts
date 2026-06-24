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

export const pricingTiers: PricingTier[] = SUBSCRIPTION_PLANS.map((plan) => {
  const base: PricingTier = {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    monthlyPrice: plan.priceInCents / 100,
    annualPrice: plan.annualPriceInCents / 100,
    features: plan.features,
    cta: plan.id === "enterprise" ? "Contact Sales" : "Start Free Trial",
  }
  switch (plan.id) {
    case "starter":
      return {
        ...base,
        limits: {
          users: plan.limits.users,
          dataPoints: "100K",
          modules: plan.limits.modules,
          apiCalls: "1,000/month",
        },
      }
    case "professional":
      return {
        ...base,
        limits: {
          users: plan.limits.users,
          dataPoints: "1M",
          modules: plan.limits.modules,
          apiCalls: "10,000/month",
        },
        highlighted: true,
      }
    case "enterprise":
      return {
        ...base,
        limits: {
          users: "unlimited" as const,
          dataPoints: "Unlimited",
          modules: "all" as const,
          apiCalls: "Unlimited",
        },
      }
    default:
      return base
  }
})

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
