import { T } from "@/components/i18n/t"
import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import { AuroraBackground } from "@/components/digit/aurora-background"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"

export default function UnauthorizedPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-6">
      <AuroraBackground />
      <AnimatedGroup className="relative flex flex-col items-center gap-4 text-center max-w-md">
        <div className="rounded-full bg-destructive/10 p-4">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-lg font-semibold"><T>Not authorized</T></h1>
        <p className="text-sm text-muted-foreground">
          <T>You don&apos;t have permission to access this page. If you believe this is a mistake, contact your administrator.</T>
        </p>
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          <T>Return to dashboard</T>
        </Link>
      </AnimatedGroup>
    </div>
  )
}
