import { getTranslator } from "@/lib/i18n/server"
import type { Metadata } from "next"
import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator()
  return {
    title: t("legal.privacy.metadata.title"),
    description: t("legal.privacy.metadata.description"),
    alternates: { canonical: "/privacy" },
  }
}

export default async function PrivacyPage() {
  const { t } = await getTranslator()
  return (
    <LegalPageShell
      title={t("legal.privacy.title")}
      description={t("legal.privacy.description")}
      lastUpdated={t("legal.privacy.lastUpdated")}
    >
      <LegalSection heading={t("legal.privacy.section1.heading")}>
        <p>{t("legal.privacy.section1.content")}</p>
      </LegalSection>

      <LegalSection heading={t("legal.privacy.section2.heading")}>
        <p>{t("legal.privacy.section2.content")}</p>
      </LegalSection>

      <LegalSection heading={t("legal.privacy.section3.heading")}>
        <p>{t("legal.privacy.section3.content")}</p>
      </LegalSection>

      <LegalSection heading={t("legal.privacy.section4.heading")}>
        <p>{t("legal.privacy.section4.content")}</p>
      </LegalSection>

      <LegalSection heading={t("legal.privacy.section5.heading")}>
        <p>{t("legal.privacy.section5.content")}</p>
      </LegalSection>

      <LegalSection heading={t("legal.privacy.section6.heading")}>
        <p>{t("legal.privacy.section6.content")}</p>
      </LegalSection>

      <LegalSection heading={t("legal.privacy.section7.heading")}>
        <p>{t("legal.privacy.section7.content")}</p>
      </LegalSection>
    </LegalPageShell>
  )
}
