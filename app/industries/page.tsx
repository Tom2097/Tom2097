import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { INDUSTRIES } from "@/lib/industries"

export const metadata: Metadata = {
  title: "Industries | DigiT",
  description:
    "DigiT sets up your workspace for your industry: healthcare, manufacturing, legal, retail, banking and finance, and education.",
  alternates: { canonical: "/industries" },
}

export default function IndustriesPage() {
  return (
    <>
      <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground">DigiT for your industry</h1>
      <p className="mt-3 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
        One platform for CRM, operations, compliance, people, and feedback. Guided setup tailors the workspace to how
        your industry works.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {INDUSTRIES.map((industry) => (
          <Link key={industry.slug} href={`/industries/${industry.slug}`}>
            <Card className="group h-full p-6 transition-all duration-300 hover:border-primary/30">
              <h2 className="text-xl font-semibold text-foreground transition-colors group-hover:text-primary">
                {industry.name}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{industry.summary}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                See how it works <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
