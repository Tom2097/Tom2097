"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Clock } from "lucide-react"
import { Logo } from "@/components/digit/logo"
import { AuroraBackground } from "@/components/digit/aurora-background"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"
import { CAPACITY_MESSAGES } from "@/lib/platform/capacity"
import { useI18n } from "@/components/providers/i18n-provider"

export default function AuthErrorPage() {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const reason = searchParams?.get("reason")
  const atCapacity = reason === "platform_at_capacity"

  if (atCapacity) {
    return (
      <div className="relative min-h-screen bg-background flex items-center justify-center p-4">
        <AuroraBackground />
        <Card className="w-full max-w-md relative bg-card/80 backdrop-blur-xl border-border/50 text-center">
          <CardHeader>
            <AnimatedGroup className="space-y-2">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Logo size="md" />
              </div>
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-primary" />
              </div>
               <CardTitle className="text-2xl text-balance">{t("auth.error.atCapacity")}</CardTitle>
               <CardDescription>{t("auth.error.onboardingWaves")}</CardDescription>
            </AnimatedGroup>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-pretty">{CAPACITY_MESSAGES.tenantsFull}</p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Back to home</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-4">
      <AuroraBackground />

      <Card className="w-full max-w-md relative bg-card/80 backdrop-blur-xl border-border/50 text-center">
        <CardHeader>
          <AnimatedGroup className="space-y-2">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Logo size="md" />
            </div>
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
             <CardTitle className="text-2xl">{t("auth.error.authError")}</CardTitle>
             <CardDescription>{t("auth.error.somethingWentWrong")}</CardDescription>
          </AnimatedGroup>
        </CardHeader>
        <CardContent className="space-y-4">
           <p className="text-sm text-muted-foreground">
             {t("auth.error.tryAgain")}
           </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
           <Button asChild className="w-full">
             <Link href="/auth/login">{t("auth.error.trySigningIn")}</Link>
           </Button>
           <Button asChild variant="outline" className="w-full">
             <Link href="/auth/sign-up">{t("auth.error.createAccount")}</Link>
           </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
