import type { Metadata } from "next"
import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell"

export const metadata: Metadata = {
  title: "Security | DigiT",
  description: "How DigiT protects your data with enterprise-grade security, encryption, and access controls.",
}

export default function SecurityPage() {
  return (
    <LegalPageShell
      title="Security"
      description="Security is foundational to DigiT. Here is how we protect your data and infrastructure."
      lastUpdated="June 17, 2026"
    >
      <LegalSection heading="Data Encryption">
        <p>
          All data is encrypted in transit using TLS and at rest using industry-standard AES-256 encryption. Sensitive
          credentials and secrets are stored in encrypted, access-controlled vaults.
        </p>
      </LegalSection>

      <LegalSection heading="Tenant Isolation">
        <p>
          DigiT is built on a multi-tenant architecture with strict logical isolation. Row-level security policies
          enforce that each organization can only access its own data, scoped to its tenant boundary at the database
          level.
        </p>
      </LegalSection>

      <LegalSection heading="Access Controls">
        <p>
          We enforce role-based access control (RBAC) with granular permissions across every module. Administrative
          actions are protected, and all privileged operations are recorded in an immutable audit log.
        </p>
      </LegalSection>

      <LegalSection heading="Authentication">
        <p>
          Authentication is handled through a secure, industry-standard provider with hashed credentials, session
          management, and email verification. We never store plaintext passwords.
        </p>
      </LegalSection>

      <LegalSection heading="Audit Logging">
        <p>
          Security-relevant events are captured in a tamper-resistant audit trail, giving organizations full
          visibility into access, configuration changes, and data operations within their workspace.
        </p>
      </LegalSection>

      <LegalSection heading="Infrastructure">
        <p>
          Our platform runs on hardened, continuously monitored cloud infrastructure with automated backups, network
          isolation, and DDoS protection. We apply security patches promptly and follow the principle of least
          privilege throughout our systems.
        </p>
      </LegalSection>

      <LegalSection heading="Reporting a Vulnerability">
        <p>
          We welcome responsible disclosure. If you believe you have found a security vulnerability, please contact our
          security team at{" "}
          <a href="mailto:security@digit-ai.org" className="text-primary hover:underline">
            security@digit-ai.org
          </a>
          . We investigate all legitimate reports promptly.
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}
