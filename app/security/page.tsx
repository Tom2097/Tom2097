import { getTranslator } from "@/lib/i18n/server"
import type { Metadata } from "next"
import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator()
  return {
    title: t("legal.security.metadata.title"),
    description: t("legal.security.metadata.description"),
    alternates: { canonical: "/security" },
  }
}

export default async function SecurityPage() {
  const { t } = await getTranslator()
  return (
    <LegalPageShell
      title={t("legal.security.title")}
      description={t("legal.security.description")}
      lastUpdated={t("legal.security.lastUpdated")}
    >
      <LegalSection heading={t("legal.security.encryption.heading")}>
        <p>{t("legal.security.encryption.content")}</p>
      </LegalSection>

      <LegalSection heading={t("legal.security.isolation.heading")}>
        <p>{t("legal.security.isolation.content")}</p>
      </LegalSection>

      <LegalSection heading={t("legal.security.access.heading")}>
        <p>{t("legal.security.access.content")}</p>
      </LegalSection>

      <LegalSection heading={t("legal.security.authentication.heading")}>
        <p>{t("legal.security.authentication.content")}</p>
      </LegalSection>

      <LegalSection heading={t("legal.security.audit.heading")}>
        <p>{t("legal.security.audit.content")}</p>
      </LegalSection>

      <LegalSection heading={t("legal.security.infrastructure.heading")}>
        <p>{t("legal.security.infrastructure.content")}</p>
      </LegalSection>

      <LegalSection heading={t("legal.security.reporting.heading")}>
        <p>
          {t("legal.security.reporting.contentBefore")}{" "}
          <a href="mailto:security@digit-ai.org" className="text-primary hover:underline">
            security@digit-ai.org
          </a>
          {t("legal.security.reporting.contentAfter")}
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}
