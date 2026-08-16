import { getTranslator } from "@/lib/i18n/server"
import type { Metadata } from "next"
import Link from "next/link"
import { Logo } from "@/components/digit/logo"
import { ArrowLeft, CheckCircle2 } from "lucide-react"
import { AuroraBackground } from "@/components/digit/aurora-background"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"
import { InView } from "@/components/motion-primitives/in-view"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator()
  return {
    title: t("status.page.title"),
    description: t("status.page.description"),
    alternates: { canonical: "/status" },
  }
}

export default async function StatusPage() {
  const { t } = await getTranslator()
  const services = [
    { name: t("status.page.webApp"), description: t("status.page.webAppDesc") },
    { name: t("status.page.api"), description: t("status.page.apiDesc") },
    { name: t("status.page.auth"), description: t("status.page.authDesc") },
    { name: t("status.page.database"), description: t("status.page.databaseDesc") },
    { name: t("status.page.aiServices"), description: t("status.page.aiServicesDesc") },
    { name: t("status.page.billing"), description: t("status.page.billingDesc") },
  ]
  return (
    <div className="relative min-h-screen bg-background">
      <AuroraBackground />

      <header className="relative border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <Link
            href="/#pricing"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("status.page.back")}
          </Link>
        </div>
      </header>

      <main className="relative container mx-auto max-w-3xl px-6 py-12 md:py-16">
        {/* Overall status banner */}
        <AnimatedGroup className="mb-10 flex items-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("status.page.allOperational")}</h1>
            <p className="text-sm text-muted-foreground">{t("status.page.allServicesNormal")}</p>
          </div>
        </AnimatedGroup>

        {/* Service list */}
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
          {services.map((service, index) => (
            <InView
              key={service.name}
              delay={index * 0.06}
              className={`flex items-center justify-between p-5 ${
                index !== services.length - 1 ? "border-b border-border/50" : ""
              }`}
            >
              <div>
                <p className="font-medium text-foreground">{service.name}</p>
                <p className="text-sm text-muted-foreground">{service.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-sm font-medium text-emerald-500">{t("status.page.operational")}</span>
              </div>
            </InView>
          ))}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          {t("status.page.contact")}{" "}
          <a href="mailto:support@digit-ai.org" className="text-primary hover:underline">
            support@digit-ai.org
          </a>
          .
        </p>
      </main>
    </div>
  )
}
