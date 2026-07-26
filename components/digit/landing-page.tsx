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
import { TextEffect } from "@/components/motion-primitives/text-effect"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"
import { InView } from "@/components/motion-primitives/in-view"
import { AuroraBackground } from "@/components/digit/aurora-background"
import { HeroSignalPanel } from "@/components/digit/hero-signal-panel"
import { WaveDivider } from "@/components/digit/wave-divider"

// Brightened from the logo's literal #1a56db for the blue slot -- verified
// against WCAG contrast: the logo's blue only reached 3.3:1 on the dark
// background (barely clears the 3:1 floor for non-text/icon use) while
// teal and green landed at 12.5:1 and 9.2:1, so blue read visibly muddier
// next to them. This tint keeps the same hue but reaches 5.2:1.
const TRIAD = ["#3ce0e2", "#3b7cf5", "#00c875"]

const modules: Array<{ icon: LucideIcon; titleKey: string; descKey: string; span: 1 | 2 }> = [
  { icon: Users, titleKey: "crm", descKey: "crmDesc", span: 2 },
  { icon: LayoutGrid, titleKey: "operations", descKey: "operationsDesc", span: 1 },
  { icon: Activity, titleKey: "performance", descKey: "performanceDesc", span: 1 },
  { icon: Boxes, titleKey: "resources", descKey: "resourcesDesc", span: 1 },
  { icon: ShieldCheck, titleKey: "compliance", descKey: "complianceDesc", span: 1 },
  { icon: MessageSquarePlus, titleKey: "feedback", descKey: "feedbackDesc", span: 2 },
  { icon: Brain, titleKey: "aiIntelligence", descKey: "aiIntelligenceDesc", span: 2 },
  { icon: BarChart3, titleKey: "aiAnalytics", descKey: "aiAnalyticsDesc", span: 2 },
]

export async function LandingPage() {
  const { t } = await getTranslator()

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      <AuroraBackground />

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

        {/* Hero -- asymmetric two-column: copy left, live product glimpse right */}
        <section className="container mx-auto grid gap-12 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-28">
          <AnimatedGroup>
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
              {t("landing.hero.badge")}
            </Badge>
            <h1 className="mt-6 max-w-2xl text-balance text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              <TextEffect text={t("landing.hero.headline")} delay={0.3} />
            </h1>
            <p className="mt-6 max-w-lg text-balance text-lg leading-relaxed text-muted-foreground">
              {t("landing.hero.subheadline")}
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
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
          </AnimatedGroup>

          <div className="flex justify-center lg:justify-end">
            <HeroSignalPanel />
          </div>
        </section>

        <WaveDivider />

        {/* Feature grid -- asymmetric bento instead of a uniform card grid */}
        <section className="container mx-auto px-6 py-16">
          <InView className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-foreground">{t("landing.modules.title")}</h2>
            <p className="mt-3 text-muted-foreground">{t("landing.modules.subtitle")}</p>
          </InView>
          <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map(({ icon: Icon, titleKey, descKey, span }, i) => {
              const accent = TRIAD[i % TRIAD.length]
              return (
                <InView
                  key={titleKey}
                  delay={(i % 4) * 0.06}
                  className={span === 2 ? "sm:col-span-2" : undefined}
                >
                  <div className="group flex h-full flex-col rounded-3xl border border-border/50 bg-card p-6 transition-all duration-300 hover:border-primary/30 hover:digit-glow-sm">
                    <div
                      className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110"
                      style={{ backgroundColor: `${accent}1a`, color: accent }}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-bold text-foreground">{t(`landing.modules.${titleKey}`)}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t(`landing.modules.${descKey}`)}
                    </p>
                  </div>
                </InView>
              )
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-6 py-20">
          <InView className="mx-auto max-w-4xl">
            <div className="flex flex-col items-center gap-6 rounded-3xl border border-primary/20 bg-primary/5 px-8 py-16 text-center digit-glow-sm">
              <h2 className="text-3xl font-bold text-foreground">{t("landing.finalCta.title")}</h2>
              <p className="max-w-xl text-muted-foreground">{t("landing.finalCta.subtitle")}</p>
              <Button size="lg" className="gap-2 digit-glow" asChild>
                <Link href="/auth/sign-up">
                  {t("landing.finalCta.cta")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </InView>
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
