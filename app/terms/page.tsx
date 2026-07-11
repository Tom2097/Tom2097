import { getTranslator } from "@/lib/i18n/server"
import type { Metadata } from "next"
import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator()
  return {
    title: t("legal.terms.metadata.title"),
    description: t("legal.terms.metadata.description"),
  }
}

export default async function TermsPage() {
  const { t } = await getTranslator()
  return (
    <LegalPageShell
      title={t("legal.terms.title")}
      description={t("legal.terms.description")}
      lastUpdated={t("legal.terms.lastUpdated")}
    >
      <LegalSection heading={t("legal.terms.section1.heading")}>
        <p>{t("legal.terms.section1.content")}</p>
      </LegalSection>

      <LegalSection heading={t("legal.terms.section2.heading")}>
        <p>{t("legal.terms.section2.intro")}</p>
        <p className="mt-4">
          <strong>{t("legal.terms.section2.monthlyLabel")}</strong> {t("legal.terms.section2.monthlyText")}
        </p>
        <p className="mt-4">
          <strong>{t("legal.terms.section2.yearlyLabel")}</strong> {t("legal.terms.section2.yearlyText")}
        </p>
        <p className="mt-4">
          {t("legal.terms.section2.refundText")}{" "}
          <a href="/settings/billing" className="text-primary hover:underline">
            {t("legal.terms.section2.refundLink")}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading={t("legal.terms.section3.heading")}>
        <p>{t("legal.terms.section3.content")}</p>
      </LegalSection>

      <LegalSection heading={t("legal.terms.section4.heading")}>
        <p>{t("legal.terms.section4.content")}</p>
      </LegalSection>

      <LegalSection heading={t("legal.terms.section5.heading")}>
        <p>{t("legal.terms.section5.content")}</p>
      </LegalSection>

      <LegalSection heading={t("legal.terms.section6.heading")}>
        <p>{t("legal.terms.section6.content")}</p>
      </LegalSection>

      <LegalSection heading={t("legal.terms.section7.heading")}>
        <p>{t("legal.terms.section7.content")}</p>
      </LegalSection>

      <LegalSection heading={t("legal.terms.section8.heading")}>
        <p>{t("legal.terms.section8.content")}</p>
      </LegalSection>
    </LegalPageShell>
  )
}
