"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, ArrowLeft, Loader2, Mail } from "lucide-react"
import { Logo } from "@/components/digit/logo"
import { AuroraBackground } from "@/components/digit/aurora-background"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"
import { useI18n } from "@/components/providers/i18n-provider"

export default function ForgotPasswordPage() {
  const { t } = useI18n()
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const result = await response.json().catch(() => ({ error: t("auth.forgotPassword.invalidResponse") }))
      if (!response.ok) {
        throw new Error(result.error || t("auth.forgotPassword.failed"))
      }
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.forgotPassword.failed"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-4">
      <AuroraBackground />

      <Card className="w-full max-w-md relative bg-card/80 backdrop-blur-xl border-border/50">
        <CardHeader className="text-center">
          <AnimatedGroup className="space-y-2">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Logo size="md" />
            </div>
            {sent ? (
              <>
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">{t("auth.forgotPassword.checkYourEmail")}</CardTitle>
                <CardDescription>{t("auth.forgotPassword.sentDesc")}</CardDescription>
              </>
            ) : (
              <>
                <CardTitle className="text-2xl">{t("auth.forgotPassword.title")}</CardTitle>
                <CardDescription>{t("auth.forgotPassword.description")}</CardDescription>
              </>
            )}
          </AnimatedGroup>
        </CardHeader>

        {sent ? (
          <CardFooter>
            <Button asChild variant="ghost" className="w-full gap-2">
              <Link href="/auth/login">
                <ArrowLeft className="w-4 h-4" />
                {t("auth.forgotPassword.backToSignIn")}
              </Link>
            </Button>
          </CardFooter>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.forgotPassword.emailLabel")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("auth.forgotPassword.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-secondary/50"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("auth.forgotPassword.sending")}
                  </>
                ) : (
                  t("auth.forgotPassword.sendLink")
                )}
              </Button>
              <Link href="/auth/login" className="text-sm text-muted-foreground hover:text-foreground text-center flex items-center justify-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" />
                {t("auth.forgotPassword.backToSignIn")}
              </Link>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}
