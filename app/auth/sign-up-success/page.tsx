"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, LogIn, Loader2, CheckCircle2 } from "lucide-react"
import { Logo } from "@/components/digit/logo"
import { useI18n } from "@/components/providers/i18n-provider"

function SignUpSuccessContent() {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const email = searchParams?.get("email") || ""
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle")

  const handleResend = async () => {
    if (!email || resendState === "sending") return
    setResendState("sending")
    try {
      await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
    } finally {
      setResendState("sent")
    }
  }

  return (
    <Card className="w-full max-w-md relative bg-card/80 backdrop-blur-xl border-border/50 text-center">
      <CardHeader>
        <div className="flex items-center justify-center gap-2 mb-4">
          <Logo size="md" />
        </div>
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <CardTitle className="text-2xl">{t("auth.signUpSuccess.checkYourEmail")}</CardTitle>
        <CardDescription>
          {email
            ? t("auth.signUpSuccess.confirmationSentTo").replace("{email}", email)
            : t("auth.signUpSuccess.confirmationSent")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("auth.signUpSuccess.clickLinkToActivate")}
        </p>
        {resendState === "sent" ? (
          <p className="text-sm text-green-500 flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            {t("auth.signUpSuccess.resendSent")}
          </p>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleResend}
            disabled={!email || resendState === "sending"}
          >
            {resendState === "sending" ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("auth.signUpSuccess.resending")}
              </>
            ) : (
              t("auth.signUpSuccess.resendEmail")
            )}
          </Button>
        )}
      </CardContent>
      <CardFooter>
        <Button asChild variant="ghost" className="w-full gap-2">
          <Link href="/auth/login">
            <LogIn className="w-4 h-4" />
            {t("auth.signUpSuccess.signIn")}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

function SignUpSuccessFallback() {
  return (
    <Card className="w-full max-w-md relative bg-card/80 backdrop-blur-xl border-border/50">
      <CardContent className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </CardContent>
    </Card>
  )
}

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,212,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,212,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <Suspense fallback={<SignUpSuccessFallback />}>
        <SignUpSuccessContent />
      </Suspense>
    </div>
  )
}
