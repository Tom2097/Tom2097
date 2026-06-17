import type { Metadata } from "next"
import Link from "next/link"
import { Zap, ArrowLeft, CheckCircle2 } from "lucide-react"

export const metadata: Metadata = {
  title: "System Status | DigiT",
  description: "Real-time operational status of DigiT platform services.",
}

const services = [
  { name: "Web Application", description: "Dashboard and user interface" },
  { name: "API", description: "Core REST API and integrations" },
  { name: "Authentication", description: "Login, signup, and session management" },
  { name: "Database", description: "Primary data storage and queries" },
  { name: "AI Services", description: "AI assistant and intelligence modules" },
  { name: "Billing & Payments", description: "Subscription and payment processing" },
]

export default function StatusPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(0,212,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,212,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />

      <header className="relative border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-cyan-400">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-xl font-bold text-transparent">
              DigiT
            </span>
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
      </header>

      <main className="relative container mx-auto max-w-3xl px-6 py-12 md:py-16">
        {/* Overall status banner */}
        <div className="mb-10 flex items-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">All Systems Operational</h1>
            <p className="text-sm text-muted-foreground">All services are running normally.</p>
          </div>
        </div>

        {/* Service list */}
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
          {services.map((service, index) => (
            <div
              key={service.name}
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
                <span className="text-sm font-medium text-emerald-500">Operational</span>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          For incident history or to report an issue, contact{" "}
          <a href="mailto:support@digit-ai.org" className="text-primary hover:underline">
            support@digit-ai.org
          </a>
          .
        </p>
      </main>
    </div>
  )
}
