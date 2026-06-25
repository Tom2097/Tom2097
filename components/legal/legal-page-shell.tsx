import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Logo } from "@/components/digit/logo"

interface LegalPageShellProps {
  title: string
  description: string
  lastUpdated?: string
  children: React.ReactNode
}

export function LegalPageShell({ title, description, lastUpdated, children }: LegalPageShellProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(0,212,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,212,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />

      {/* Header */}
      <header className="relative border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Logo size="sm" link />
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="relative container mx-auto max-w-3xl px-6 py-12 md:py-16">
        <div className="mb-10">
          <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-3 text-pretty text-lg leading-relaxed text-muted-foreground">{description}</p>
          {lastUpdated && (
            <p className="mt-4 text-sm text-muted-foreground">
              Last updated: <span className="text-foreground">{lastUpdated}</span>
            </p>
          )}
        </div>

        <div className="space-y-10">{children}</div>

        <div className="mt-16 border-t border-border/50 pt-8">
          <p className="text-sm text-muted-foreground">
            Questions? Contact us at{" "}
            <a href="mailto:legal@digit-ai.org" className="text-primary hover:underline">
              legal@digit-ai.org
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  )
}

interface LegalSectionProps {
  heading: string
  children: React.ReactNode
}

export function LegalSection({ heading, children }: LegalSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-foreground">{heading}</h2>
      <div className="space-y-3 leading-relaxed text-muted-foreground">{children}</div>
    </section>
  )
}
