// Public industry landing pages (/industries and /industries/[slug]).
//
// One page per industry setup panel in components/digit/wizard-panels/. Keep
// each page's "setup" list in step with what that panel actually asks for,
// and never describe a third-party system named in a panel's dropdown as an
// integration -- the panel records which system a customer uses; it does not
// connect to it.
export interface Industry {
  slug: string
  name: string
  /** Page <title> and H1. */
  headline: string
  /** Meta description and hero paragraph. */
  summary: string
  /** What the guided setup for this industry asks about. */
  setup: string[]
  /** How the core modules are typically used in this industry. */
  uses: Array<{ module: string; text: string }>
}

export const INDUSTRIES: Industry[] = [
  {
    slug: "healthcare",
    name: "Healthcare",
    headline: "DigiT for clinics and healthcare providers",
    summary:
      "Run patient relationships, staff, compliance, and feedback for your clinic or hospital in one workspace, with AI analytics on top.",
    setup: [
      "Your medical specialty, from primary care and pediatrics to oncology and mental health",
      "Which EHR system your team uses today",
      "The patient data fields your team needs to track",
      "Whether to turn on appointment scheduling",
    ],
    uses: [
      { module: "CRM", text: "Keep referring doctors, partner labs, and corporate health accounts in one pipeline." },
      { module: "Resources", text: "Track staff and their skills across departments." },
      { module: "Compliance", text: "Keep policies, audits, and corrective actions on schedule." },
      { module: "Feedback", text: "Collect patient feedback and see trends before they become complaints." },
    ],
  },
  {
    slug: "manufacturing",
    name: "Manufacturing",
    headline: "DigiT for manufacturers",
    summary:
      "Bring production operations, maintenance, quality, people, and customer accounts into one workspace, with forecasts and anomaly alerts.",
    setup: [
      "Your manufacturing sector, such as automotive, electronics, food and beverage, or pharmaceuticals",
      "Which MES system you run on the shop floor",
      "Your production processes",
      "Whether to turn on inventory tracking, maintenance management, and quality management",
    ],
    uses: [
      { module: "Operations", text: "Watch operational metrics and get flagged when something drifts." },
      { module: "Predictive maintenance", text: "Plan maintenance before breakdowns stop a line." },
      { module: "Compliance", text: "Track quality audits and corrective actions to closure." },
      { module: "CRM", text: "Manage distributors, dealers, and key accounts." },
    ],
  },
  {
    slug: "legal",
    name: "Legal",
    headline: "DigiT for law firms",
    summary:
      "Manage clients, matters, deadlines, documents, and your team's workload from one workspace built for professional services.",
    setup: [
      "Your practice areas, such as corporate, litigation, tax, IP, or family law",
      "Whether to turn on case management for cases, deadlines, and client matters",
      "Whether to turn on time tracking and billing",
      "Whether to turn on a client portal and document management",
    ],
    uses: [
      { module: "CRM", text: "Track prospective clients and referral sources from first call to engagement." },
      { module: "Performance", text: "Set objectives for associates and see progress across the firm." },
      { module: "Compliance", text: "Keep internal policies and regulatory deadlines in view." },
      { module: "AI assistant", text: "Ask questions about your own workspace data in plain language." },
    ],
  },
  {
    slug: "retail",
    name: "Retail",
    headline: "DigiT for retailers",
    summary:
      "Connect stores, staff, customers, and feedback in one workspace, and use AI analytics to spot what is selling and what needs attention.",
    setup: [
      "Your retail sector, such as grocery, apparel, electronics, or e-commerce",
      "Which POS system your stores use",
      "Whether you sell in stores, online, or both",
      "Whether to turn on inventory management, sales analytics, and a loyalty program",
    ],
    uses: [
      { module: "Feedback", text: "Collect customer feedback per store and track sentiment over time." },
      { module: "Resources", text: "Plan staff and skills across locations." },
      { module: "AI analytics", text: "Forecast demand and get alerts on unusual changes." },
      { module: "CRM", text: "Manage suppliers, franchisees, and B2B buyers." },
    ],
  },
  {
    slug: "banking-finance",
    name: "Banking and finance",
    headline: "DigiT for banks, NBFCs, and financial services",
    summary:
      "Manage customer relationships, operations, compliance work, and team performance in one workspace with role-based access and an audit trail.",
    setup: [
      "Your financial sector, such as retail banking, insurance, fintech, or asset management",
      "Which core banking system you use",
      "Whether to turn on customer segmentation and transaction monitoring",
      "Your regulatory compliance settings",
    ],
    uses: [
      { module: "CRM", text: "Track relationship pipelines for corporate and retail customers." },
      { module: "Compliance", text: "Keep audits, policies, and corrective actions on schedule." },
      { module: "Privacy center", text: "Handle data access, correction, and erasure requests." },
      { module: "Performance", text: "Set and review objectives for branch and sales teams." },
    ],
  },
  {
    slug: "education",
    name: "Education",
    headline: "DigiT for schools, colleges, and training providers",
    summary:
      "Run admissions, staff, training, operations, and feedback from one workspace, for institutions and corporate training teams alike.",
    setup: [
      "Your education sector, such as higher education, vocational training, test preparation, or corporate training",
      "Which LMS your institution uses",
      "Whether to turn on course management",
      "Whether to turn on analytics and reporting",
    ],
    uses: [
      { module: "CRM", text: "Track admission enquiries and partner institutions." },
      { module: "Training", text: "Plan staff training and track skills." },
      { module: "Feedback", text: "Collect feedback from students and parents and act on trends." },
      { module: "Operations", text: "Keep facilities and day-to-day operations on track." },
    ],
  },
]

export function getIndustry(slug: string): Industry | undefined {
  return INDUSTRIES.find((i) => i.slug === slug)
}
