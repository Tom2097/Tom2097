import { T } from "@/components/i18n/t"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { INDUSTRIES, getIndustry } from "@/lib/industries"
import { DEMO_MAILTO } from "@/components/digit/landing-faq"

export const dynamicParams = false

export function generateStaticParams() {
  return INDUSTRIES.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const industry = getIndustry((await params).slug)
  if (!industry) return {}
  return {
    title: `${industry.headline} | DigiT`,
    description: industry.summary,
    alternates: { canonical: `/industries/${industry.slug}` },
  }
}

export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const industry = getIndustry((await params).slug)
  if (!industry) notFound()

  const others = INDUSTRIES.filter((i) => i.slug !== industry.slug)

  return (
    <>
      <Link href="/industries" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
        All industries
      </Link>
      <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight text-foreground">{industry.headline}</h1>
      <p className="mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">{industry.summary}</p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" className="gap-2" asChild>
          <Link href="/auth/sign-up">
            <T>Start free trial</T>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <a href={DEMO_MAILTO}>
            <T>Book a demo</T>
          </a>
        </Button>
      </div>

      <section className="mt-14">
        <h2 className="text-2xl font-bold text-foreground">How DigiT is used in {industry.name.toLowerCase()}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {industry.uses.map((use) => (
            <Card key={use.module} className="p-6">
              <h3 className="font-semibold text-foreground">{use.module}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{use.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-bold text-foreground">Set up for {industry.name.toLowerCase()} in minutes</h2>
        <p className="mt-2 text-muted-foreground">The guided setup asks about:</p>
        <ul className="mt-4 space-y-3">
          {industry.setup.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="text-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14 rounded-3xl border border-primary/20 bg-primary/5 p-8">
        <h2 className="text-2xl font-bold text-foreground">Every module, one price</h2>
        <p className="mt-2 text-muted-foreground">
          Every subscription starts with a 1-month free trial. Your card is verified, not charged, until the trial ends.
        </p>
        <Button className="mt-6" asChild>
          <Link href="/#pricing">See pricing</Link>
        </Button>
      </section>

      <nav className="mt-14 border-t border-border/50 pt-8">
        <p className="text-sm text-muted-foreground">Other industries</p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {others.map((o) => (
            <Link key={o.slug} href={`/industries/${o.slug}`} className="text-sm text-primary hover:underline">
              {o.name}
            </Link>
          ))}
        </div>
      </nav>
    </>
  )
}
