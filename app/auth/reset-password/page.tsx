"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Loader2, Check } from "lucide-react"
import { Logo } from "@/components/digit/logo"
import { AuroraBackground } from "@/components/digit/aurora-background"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"

const PRODUCTION_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://digit-ai.org"

function ResetPasswordForm() {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Redirect localhost links to production
  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      const productionUrl = new URL(window.location.pathname + window.location.search, PRODUCTION_URL)
      window.location.replace(productionUrl.toString())
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError(t("auth.resetPassword.passwordsDoNotMatch"))
      return
    }

    if (password.length < 8) {
      setError(t("auth.resetPassword.minLength"))
      return
    }

    setIsLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setIsLoading(false)
    } else {
      setSuccess(true)
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="relative min-h-screen bg-background flex items-center justify-center p-4">
        <AuroraBackground />
        <Card className="w-full max-w-md relative">
          <CardHeader className="text-center">
            <AnimatedGroup className="space-y-2">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Logo size="lg" />
              </div>
              <CardTitle className="text-2xl">{t("auth.resetPassword.successTitle")}</CardTitle>
              <CardDescription>{t("auth.resetPassword.successDesc")}</CardDescription>
            </AnimatedGroup>
          </CardHeader>
          <CardContent className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-6 h-6 text-green-500" />
              </div>
            </div>
            <Button onClick={() => window.location.href = "/auth/login"} className="w-full">
              {t("auth.resetPassword.signIn")}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-4">
      <AuroraBackground />
      <Card className="w-full max-w-md relative">
        <CardHeader className="text-center">
          <AnimatedGroup className="space-y-2">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Logo size="lg" />
            </div>
            <CardTitle className="text-2xl">{t("auth.resetPassword.title")}</CardTitle>
            <CardDescription>{t("auth.resetPassword.description")}</CardDescription>
          </AnimatedGroup>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.resetPassword.newPasswordLabel")}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t("auth.resetPassword.newPasswordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("auth.resetPassword.confirmPasswordLabel")}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t("auth.resetPassword.confirmPasswordPlaceholder")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("auth.resetPassword.updating")}
                </>
              ) : (
                t("auth.resetPassword.resetPassword")
              )}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}

export default function ResetPasswordPage() {
  const { t } = useI18n()
  return (
    <Suspense fallback={
      <div className="relative min-h-screen bg-background flex items-center justify-center p-4">
        <AuroraBackground />
        <Card className="w-full max-w-md relative">
          <CardContent className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">{t("auth.resetPassword.loading")}</p>
          </CardContent>
        </Card>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
