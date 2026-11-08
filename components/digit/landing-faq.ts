// Homepage FAQ. Shared by the visible FAQ section (components/digit/landing-page.tsx,
// translated via the phrase table) and the FAQPage structured data on the
// homepage (app/(dashboard)/page.tsx), so the two can never drift apart --
// Google ignores FAQ markup that doesn't match the visible text.
//
// Every answer here must stay true to the product: check the code, the
// Terms, and the Refund policy before changing one.
export const SUPPORT_EMAIL = "support@digit-ai.org"
export const DEMO_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("DigiT demo request")}`

export const LANDING_FAQ: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: "What is DigiT?",
    a: "DigiT is one workspace for running a business: CRM, operations, performance, resources, compliance, and customer feedback, with AI analytics and an AI assistant built on your own data.",
  },
  {
    q: "How does the free trial work?",
    a: "Every subscription starts with a 1-month free trial with every module included (3 months for sign-ups until 11 November 2026, as part of our Diwali offer). You add a card at checkout so it can be verified, but nothing is charged until the trial ends.",
  },
  {
    q: "Can I cancel?",
    a: "Yes. You can manage or cancel your subscription from Settings, under Billing. See the Refund policy for how refunds work on each billing option.",
  },
  {
    q: "Is DigiT available in Hindi and Punjabi?",
    a: "Yes. The app is available in English, Hindi, and Punjabi. Each person can switch language at any time.",
  },
  {
    q: "How is my data protected?",
    a: "Data is encrypted in transit and at rest, each organization's data is isolated with row-level security, and access is controlled by roles. The Security page has the details.",
  },
  {
    q: "Does DigiT help with DPDP and privacy requests?",
    a: "DigiT includes a privacy center where people can request a copy of their data, correction, or erasure, and where consent records are kept. It supports your compliance work but is not legal advice.",
  },
  {
    q: "Can I see a demo first?",
    a: `Yes. Email ${SUPPORT_EMAIL} with your company name and what you want to see, and we will set up a walkthrough.`,
  },
]

export function faqStructuredData() {
  return {
    "@type": "FAQPage",
    mainEntity: LANDING_FAQ.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  }
}
