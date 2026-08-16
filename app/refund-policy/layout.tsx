import { getTranslator } from "@/lib/i18n/server"
import type { Metadata } from "next"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator()
  return {
    title: t("legal.refundPolicy.metadata.title"),
    description: t("legal.refundPolicy.metadata.description"),
    alternates: { canonical: "/refund-policy" },
  }
}

export default function RefundPolicyLayout({ children }: { children: React.ReactNode }) {
  return children
}
