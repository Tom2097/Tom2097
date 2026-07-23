import Link from "next/link"
import {
  ArrowRight,
  Users,
  LayoutGrid,
  Activity,
  Boxes,
  ShieldCheck,
  MessageSquarePlus,
  Brain,
  BarChart3,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Logo } from "@/components/digit/logo"
import { getTranslator } from "@/lib/i18n/server"

const modules: Array<{ icon: LucideIcon; titleKey: string; descKey: string }> = [
  { icon: Users, titleKey: "crm", descKey: "crmDesc" },
  { icon: LayoutGrid, titleKey: "operations", descKey: "operationsDesc" },
  { icon: Activity, titleKey: "performance", descKey: "performanceDesc" },
  { icon: Boxes, titleKey: "resources", descKey: "resourcesDesc" },
  { icon: ShieldCheck, titleKey: "compliance", descKey: "complianceDesc" },
  { icon: MessageSquarePlus, titleKey: "feedback", descKey: "feedbackDesc" },
  { icon: Brain, titleKey: "aiIntelligence", descKey: "aiIntelligenceDesc" },
  { icon: BarChart3, titleKey: "aiAnalytics", descKey: "aiAnalyticsDesc" },
]

export async function LandingPage() {
  const { t } = await getTranslator()

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 digit-radial-bg" />
      <div className="pointer-events-none fixed inset-0 digit-grid-bg opacity-30" />

      <div className="relative">
        {/* Header */}
        <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="container mx-auto flex items-center justify-between px-6 py-4">
            <Logo size="md" />
            <nav className="flex items-center gap-3">
              <Link
                href="/pricing"
                className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
              >
                {t("navigation.pricing")}
              </Link>
              <Button variant="outline" size="sm" asChild>
                <Link href="/auth/login">{t("landing.header.signIn")}</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/auth/sign-up">{t("landing.header.getStarted")}</Link>
              </Button>
            </nav>
          </div>
        </header>

        {/* Hero */}
        <section className="container mx-auto px-6 py-24 text-center">
          <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/5 text-primary">
            {t("landing.hero.badge")}
          </Badge>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {t("landing.hero.headline")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground">
            {t("landing.hero.subheadline")}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="gap-2 digit-glow" asChild>
              <Link href="/auth/sign-up">
                {t("landing.hero.ctaPrimary")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/pricing">{t("landing.hero.ctaSecondary")}</Link>
            </Button>
          </div>
        </section>

        {/* Feature grid */}
        <section className="container mx-auto px-6 py-16">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-foreground">{t("landing.modules.title")}</h2>
            <p className="mt-3 text-muted-foreground">{t("landing.modules.subtitle")}</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map(({ icon: Icon, titleKey, descKey }) => (
              <div
                key={titleKey}
                className="group flex flex-col rounded-3xl border border-border/50 bg-card p-6 transition-all duration-300 hover:border-primary/50 hover:digit-glow-sm"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-foreground">{t(`landing.modules.${titleKey}`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(`landing.modules.${descKey}`)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-6 py-20">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 rounded-3xl border border-primary/20 bg-primary/5 px-8 py-16 text-center digit-glow-sm">
            <h2 className="text-3xl font-bold text-foreground">{t("landing.finalCta.title")}</h2>
            <p className="max-w-xl text-muted-foreground">{t("landing.finalCta.subtitle")}</p>
            <Button size="lg" className="gap-2 digit-glow" asChild>
              <Link href="/auth/sign-up">
                {t("landing.finalCta.cta")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/50">
          <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
            <Logo size="sm" />
            <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <Link href="/pricing" className="transition-colors hover:text-foreground">
                {t("navigation.pricing")}
              </Link>
              <Link href="/security" className="transition-colors hover:text-foreground">
                {t("landing.footer.security")}
              </Link>
              <Link href="/status" className="transition-colors hover:text-foreground">
                {t("landing.footer.status")}
              </Link>
              <Link href="/privacy" className="transition-colors hover:text-foreground">
                {t("landing.footer.privacy")}
              </Link>
              <Link href="/terms" className="transition-colors hover:text-foreground">
                {t("landing.footer.terms")}
              </Link>
            </nav>
            <p className="text-xs text-muted-foreground/60">{t("landing.footer.copyright")}</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
