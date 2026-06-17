import type { Metadata } from "next"
import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell"

export const metadata: Metadata = {
  title: "Privacy Policy | DigiT",
  description:
    "How DigiT collects, uses, protects, and shares your information across our enterprise intelligence platform.",
}

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      description="Your privacy matters. This policy explains what data we collect, why we collect it, and how we keep it safe."
      lastUpdated="June 17, 2026"
    >
      <LegalSection heading="1. Information We Collect">
        <p>
          We collect information you provide directly, such as your name, email address, company details, and billing
          information when you create an account or subscribe to a plan. We also collect usage data, device
          information, and log data automatically as you interact with the platform.
        </p>
      </LegalSection>

      <LegalSection heading="2. How We Use Your Information">
        <p>
          We use your information to provide and improve our services, process payments, send transactional and
          service-related communications, provide customer support, and ensure the security and integrity of our
          platform. We never sell your personal data.
        </p>
      </LegalSection>

      <LegalSection heading="3. Data Storage and Security">
        <p>
          Your data is stored on secure, access-controlled infrastructure with encryption in transit and at rest. Each
          organization&apos;s data is logically isolated using row-level security, ensuring tenants can only access
          their own records.
        </p>
      </LegalSection>

      <LegalSection heading="4. Data Sharing">
        <p>
          We share data only with trusted sub-processors required to operate the service (for example, payment
          processing and cloud hosting), and only to the extent necessary. All sub-processors are bound by
          confidentiality and data-protection obligations.
        </p>
      </LegalSection>

      <LegalSection heading="5. Your Rights">
        <p>
          Depending on your jurisdiction, you may have the right to access, correct, export, or delete your personal
          data. You can exercise these rights, including GDPR data-subject access requests, by contacting us. We
          respond to verified requests within 30 days.
        </p>
      </LegalSection>

      <LegalSection heading="6. Data Retention">
        <p>
          We retain personal data only as long as necessary to provide the service and meet legal obligations.
          Organizations can configure custom retention policies for their data within the platform. When data is no
          longer needed, it is securely purged.
        </p>
      </LegalSection>

      <LegalSection heading="7. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. Material changes will be communicated through the
          platform or via email. Continued use of the service after changes take effect constitutes acceptance.
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}
