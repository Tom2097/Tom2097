import type { Metadata } from "next"
import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell"

export const metadata: Metadata = {
  title: "Terms of Service | DigiT",
  description: "The terms and conditions governing your use of the DigiT enterprise intelligence platform.",
}

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms of Service"
      description="These terms govern your access to and use of DigiT. By using the platform, you agree to them."
      lastUpdated="June 17, 2026"
    >
      <LegalSection heading="1. Acceptance of Terms">
        <p>
          By accessing or using DigiT, you agree to be bound by these Terms of Service and all applicable laws. If you
          are using the service on behalf of an organization, you represent that you have authority to bind that
          organization to these terms.
        </p>
      </LegalSection>

      <LegalSection heading="2. Accounts and Subscriptions">
        <p>
          You are responsible for maintaining the confidentiality of your account credentials and for all activity
          under your account. Subscriptions renew automatically unless canceled. Fees are billed in advance and are
          non-refundable except where required by law.
        </p>
      </LegalSection>

      <LegalSection heading="3. Acceptable Use">
        <p>
          You agree not to misuse the platform, including by attempting to gain unauthorized access, disrupting
          service integrity, reverse-engineering the software, or using the service to store or transmit unlawful
          content. We may suspend accounts that violate these terms.
        </p>
      </LegalSection>

      <LegalSection heading="4. Customer Data">
        <p>
          You retain all rights to the data you submit to the platform. You grant us a limited license to process that
          data solely to provide the service. We process data in accordance with our Privacy Policy and applicable
          data-protection agreements.
        </p>
      </LegalSection>

      <LegalSection heading="5. Service Availability">
        <p>
          We strive to maintain high availability but do not guarantee uninterrupted access. We may perform
          maintenance, modify features, or discontinue parts of the service with reasonable notice where practical.
        </p>
      </LegalSection>

      <LegalSection heading="6. Limitation of Liability">
        <p>
          To the maximum extent permitted by law, DigiT shall not be liable for any indirect, incidental, or
          consequential damages arising from your use of the service. Our total liability is limited to the amount you
          paid in the twelve months preceding the claim.
        </p>
      </LegalSection>

      <LegalSection heading="7. Termination">
        <p>
          You may cancel your subscription at any time. We may suspend or terminate access for breach of these terms.
          Upon termination, you may export your data for a limited period before it is purged per our retention
          policies.
        </p>
      </LegalSection>

      <LegalSection heading="8. Governing Law">
        <p>
          These terms are governed by the laws of the jurisdiction in which DigiT operates, without regard to conflict
          of law principles. Disputes will be resolved in the competent courts of that jurisdiction.
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}
