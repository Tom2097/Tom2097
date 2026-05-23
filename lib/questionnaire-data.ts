export const QUESTIONNAIRE_STEPS = [
  {
    id: 1,
    title: "Welcome",
    subtitle: "Let's get to know your business",
    description: "Answer a few questions so our AI can recommend the perfect solutions for you"
  },
  {
    id: 2,
    title: "Industry & Size",
    subtitle: "Tell us about your company",
    description: "This helps us tailor recommendations to your specific sector"
  },
  {
    id: 3,
    title: "Goals & Challenges",
    subtitle: "What are you trying to achieve?",
    description: "Understanding your priorities helps us prioritize solutions"
  },
  {
    id: 4,
    title: "Technical Readiness",
    subtitle: "Your current tech landscape",
    description: "We'll factor in your existing tools and capabilities"
  },
  {
    id: 5,
    title: "AI Analysis",
    subtitle: "Analyzing your requirements",
    description: "Our AI is finding the best solutions for your business"
  }
]

export const INDUSTRIES = [
  { value: "healthcare", label: "Healthcare & Life Sciences", icon: "Heart" },
  { value: "finance", label: "Banking & Financial Services", icon: "Building2" },
  { value: "retail", label: "Retail & E-commerce", icon: "ShoppingCart" },
  { value: "manufacturing", label: "Manufacturing & Industrial", icon: "Factory" },
  { value: "technology", label: "Technology & Software", icon: "Cpu" },
  { value: "agriculture", label: "Agriculture & Agro-Tech", icon: "Wheat" },
  { value: "pharma", label: "Pharmaceuticals & Biotech", icon: "Pill" },
  { value: "logistics", label: "Logistics & Supply Chain", icon: "Truck" },
  { value: "energy", label: "Energy & Utilities", icon: "Zap" },
  { value: "education", label: "Education & EdTech", icon: "GraduationCap" },
  { value: "realestate", label: "Real Estate & Construction", icon: "Building" },
  { value: "media", label: "Media & Entertainment", icon: "Film" },
  { value: "hospitality", label: "Hospitality & Travel", icon: "Plane" },
  { value: "other", label: "Other", icon: "MoreHorizontal" }
]

export const COMPANY_SIZES = [
  { value: "startup", label: "Startup", description: "1-10 employees" },
  { value: "small", label: "Small Business", description: "11-50 employees" },
  { value: "medium", label: "Mid-Market", description: "51-500 employees" },
  { value: "large", label: "Enterprise", description: "501-5000 employees" },
  { value: "enterprise", label: "Large Enterprise", description: "5000+ employees" }
]

export const EMPLOYEE_RANGES = [
  { value: "1-10", label: "1-10" },
  { value: "11-50", label: "11-50" },
  { value: "51-200", label: "51-200" },
  { value: "201-500", label: "201-500" },
  { value: "501-1000", label: "501-1,000" },
  { value: "1001-5000", label: "1,001-5,000" },
  { value: "5000+", label: "5,000+" }
]

export const REVENUE_RANGES = [
  { value: "pre-revenue", label: "Pre-revenue" },
  { value: "0-1m", label: "$0 - $1M" },
  { value: "1-10m", label: "$1M - $10M" },
  { value: "10-50m", label: "$10M - $50M" },
  { value: "50-100m", label: "$50M - $100M" },
  { value: "100-500m", label: "$100M - $500M" },
  { value: "500m+", label: "$500M+" }
]

export const BUSINESS_STAGES = [
  { value: "ideation", label: "Ideation", description: "Validating the concept" },
  { value: "early", label: "Early Stage", description: "Building product & team" },
  { value: "growth", label: "Growth", description: "Scaling operations" },
  { value: "expansion", label: "Expansion", description: "Entering new markets" },
  { value: "mature", label: "Mature", description: "Optimizing & diversifying" }
]

export const PRIMARY_GOALS = [
  { value: "increase-revenue", label: "Increase Revenue", description: "Grow sales and market share" },
  { value: "reduce-costs", label: "Reduce Operational Costs", description: "Optimize spending and efficiency" },
  { value: "improve-customer", label: "Improve Customer Experience", description: "Enhance satisfaction and retention" },
  { value: "automate-processes", label: "Automate Business Processes", description: "Reduce manual work" },
  { value: "data-driven", label: "Become Data-Driven", description: "Make smarter decisions with analytics" },
  { value: "scale-operations", label: "Scale Operations", description: "Support rapid growth" },
  { value: "compliance", label: "Ensure Compliance", description: "Meet regulatory requirements" },
  { value: "innovation", label: "Drive Innovation", description: "Stay ahead of competition" }
]

export const CHALLENGES = [
  { value: "data-silos", label: "Data Silos", description: "Information scattered across systems" },
  { value: "manual-processes", label: "Manual Processes", description: "Too much time on repetitive tasks" },
  { value: "lack-visibility", label: "Lack of Visibility", description: "Can't see the full picture" },
  { value: "forecasting", label: "Poor Forecasting", description: "Difficulty predicting outcomes" },
  { value: "customer-churn", label: "Customer Churn", description: "Losing customers to competitors" },
  { value: "slow-decisions", label: "Slow Decision Making", description: "Takes too long to act on insights" },
  { value: "scaling-issues", label: "Scaling Challenges", description: "Systems can't keep up with growth" },
  { value: "talent-shortage", label: "Talent Shortage", description: "Hard to find skilled people" },
  { value: "integration", label: "System Integration", description: "Tools don't work together" },
  { value: "security", label: "Security Concerns", description: "Data protection and privacy" }
]

export const TECHNICAL_MATURITY = [
  { value: "basic", label: "Basic", description: "Spreadsheets and email" },
  { value: "developing", label: "Developing", description: "Some business software" },
  { value: "intermediate", label: "Intermediate", description: "Integrated systems" },
  { value: "advanced", label: "Advanced", description: "Modern tech stack" },
  { value: "cutting-edge", label: "Cutting Edge", description: "AI/ML already in use" }
]

export const EXISTING_TOOLS = [
  { value: "salesforce", label: "Salesforce" },
  { value: "hubspot", label: "HubSpot" },
  { value: "sap", label: "SAP" },
  { value: "oracle", label: "Oracle" },
  { value: "microsoft365", label: "Microsoft 365" },
  { value: "google-workspace", label: "Google Workspace" },
  { value: "slack", label: "Slack" },
  { value: "zoom", label: "Zoom" },
  { value: "quickbooks", label: "QuickBooks" },
  { value: "netsuite", label: "NetSuite" },
  { value: "tableau", label: "Tableau" },
  { value: "power-bi", label: "Power BI" },
  { value: "snowflake", label: "Snowflake" },
  { value: "aws", label: "AWS" },
  { value: "azure", label: "Azure" },
  { value: "gcp", label: "Google Cloud" },
  { value: "custom", label: "Custom/In-house" },
  { value: "none", label: "None" }
]

export const BUDGET_RANGES = [
  { value: "under-5k", label: "Under $5,000/month" },
  { value: "5-10k", label: "$5,000 - $10,000/month" },
  { value: "10-25k", label: "$10,000 - $25,000/month" },
  { value: "25-50k", label: "$25,000 - $50,000/month" },
  { value: "50k+", label: "$50,000+/month" },
  { value: "flexible", label: "Flexible / TBD" }
]

export const TIMELINE_URGENCY = [
  { value: "immediate", label: "Immediate", description: "Need it ASAP" },
  { value: "1-3months", label: "1-3 Months", description: "Short-term priority" },
  { value: "3-6months", label: "3-6 Months", description: "Planning ahead" },
  { value: "6-12months", label: "6-12 Months", description: "Long-term initiative" },
  { value: "exploring", label: "Just Exploring", description: "No specific timeline" }
]

export const GEOGRAPHIC_SCOPE = [
  { value: "local", label: "Local", description: "Single city/region" },
  { value: "national", label: "National", description: "One country" },
  { value: "regional", label: "Regional", description: "Multiple countries" },
  { value: "global", label: "Global", description: "Worldwide operations" }
]

export const COMPLIANCE_REQUIREMENTS = [
  { value: "hipaa", label: "HIPAA", description: "Healthcare data" },
  { value: "gdpr", label: "GDPR", description: "EU data protection" },
  { value: "sox", label: "SOX", description: "Financial reporting" },
  { value: "pci-dss", label: "PCI DSS", description: "Payment card data" },
  { value: "iso27001", label: "ISO 27001", description: "Information security" },
  { value: "soc2", label: "SOC 2", description: "Service organization controls" },
  { value: "ccpa", label: "CCPA", description: "California privacy" },
  { value: "fda", label: "FDA", description: "Food & drug regulations" },
  { value: "none", label: "None specific", description: "No special requirements" }
]

// Warm-up questions for conversational feel
export const WARMUP_QUESTIONS = [
  "What's the biggest headache in your business right now?",
  "If you could wave a magic wand, what would you automate first?",
  "What keeps you up at night about your business?",
  "Where do you see your company in 2 years?",
  "What's one thing your competitors do better than you?"
]

export type QuestionnaireData = {
  // Step 2: Industry & Size
  industry: string
  subIndustry?: string
  companySize: string
  employeeCountRange: string
  annualRevenueRange: string
  businessStage: string
  geographicScope: string
  
  // Step 3: Goals & Challenges
  primaryGoals: string[]
  currentChallenges: string[]
  warmupResponse?: string
  
  // Step 4: Technical Readiness
  technicalMaturity: string
  existingTools: string[]
  budgetRange: string
  timelineUrgency: string
  complianceRequirements: string[]
}

export const DEFAULT_QUESTIONNAIRE_DATA: QuestionnaireData = {
  industry: "",
  companySize: "",
  employeeCountRange: "",
  annualRevenueRange: "",
  businessStage: "",
  geographicScope: "",
  primaryGoals: [],
  currentChallenges: [],
  technicalMaturity: "",
  existingTools: [],
  budgetRange: "",
  timelineUrgency: "",
  complianceRequirements: []
}
