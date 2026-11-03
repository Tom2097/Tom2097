import { T } from "@/components/i18n/t"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Logo } from "@/components/digit/logo"
import { AuroraBackground } from "@/components/digit/aurora-background"

export default function IndustriesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background">
      <AuroraBackground />
      <header className="relative border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Logo size="sm" link />
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <T>Back to home</T>
          </Link>
        </div>
      </header>
      <main className="relative container mx-auto max-w-4xl px-6 py-12 md:py-16">{children}</main>
    </div>
  )
}
