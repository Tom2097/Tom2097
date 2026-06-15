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

export const pricingTiers: PricingTier[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Perfect for small teams getting started with AI-powered analytics",
    monthlyPrice: 299,
    annualPrice: 249,
    features: [
      "1 Platform Module",
      "5 Team Members",
      "100K Data Points/month",
      "Basic AI Assistant",
      "Email Support",
      "Standard Dashboards",
      "7-day Data Retention",
      "Community Access"
    ],
    limits: {
      users: 5,
      dataPoints: "100K",
      modules: 1,
      apiCalls: "1,000/month"
    },
    cta: "Start Free Trial"
  },
  {
    id: "professional",
    name: "Professional",
    description: "Advanced analytics for growing businesses with complex needs",
    monthlyPrice: 999,
    annualPrice: 849,
    features: [
      "3 Platform Modules",
      "25 Team Members",
      "1M Data Points/month",
      "Advanced AI Assistant",
      "Priority Support",
      "Custom Dashboards",
      "90-day Data Retention",
      "API Access",
      "Webhook Integrations",
      "Export to CSV/PDF"
    ],
    limits: {
      users: 25,
      dataPoints: "1M",
      modules: 3,
      apiCalls: "10,000/month"
    },
    highlighted: true,
    cta: "Start Free Trial"
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Full-scale deployment with dedicated support and custom solutions",
    monthlyPrice: 4999,
    annualPrice: 4249,
    features: [
      "All Platform Modules",
      "Unlimited Team Members",
      "Unlimited Data Points",
      "Custom AI Models",
      "Dedicated Success Manager",
      "White-label Option",
      "Unlimited Data Retention",
      "Full API Access",
      "SSO/SAML Integration",
      "Custom Integrations",
      "SLA Guarantee (99.9%)",
      "On-premise Deployment Option",
      "Compliance (SOC2, HIPAA)"
    ],
    limits: {
      users: "unlimited",
      dataPoints: "Unlimited",
      modules: "all",
      apiCalls: "Unlimited"
    },
    cta: "Contact Sales"
  }
]

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
