"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { Suspense, useState, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Loader2, Eye, EyeOff, Check, X, Shield } from "lucide-react"
import { Logo } from "@/components/digit/logo"
import { AuroraBackground } from "@/components/digit/aurora-background"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"
import { createClient } from "@/lib/supabase/client"
import { GoogleIcon } from "@/components/auth/google-icon"

function getPasswordStrength(password: string, t: (key: string) => string) {
  let score = 0
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  }

  if (checks.length) score++
  if (checks.uppercase) score++
  if (checks.lowercase) score++
  if (checks.number) score++
  if (checks.special) score++

  let label = t("auth.signUp.veryWeak")
  let color = "bg-destructive"
  if (score >= 5) { label = t("auth.signUp.veryStrong"); color = "bg-green-500" }
  else if (score >= 4) { label = t("auth.signUp.strong"); color = "bg-green-400" }
  else if (score >= 3) { label = t("auth.signUp.fair"); color = "bg-amber-400" }
  else if (score >= 2) { label = t("auth.signUp.weak"); color = "bg-orange-500" }

  return { score, checks, label, color }
}

function SignUpForm() {
  const { t } = useI18n()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [fullName, setFullName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  // The pricing/checkout pages send the plan a visitor picked as
  // /auth/sign-up?plan=<planId> -- forward it to the API so the account
  // created here starts on that plan instead of silently dropping it (see
  // app/api/auth/sign-up/route.ts and app/auth/callback/route.ts).
  const plan = searchParams?.get("plan") || undefined

  const strength = useMemo(() => getPasswordStrength(password, t), [password, t])
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      setError(t("auth.signUp.passwordsDoNotMatchError"))
      return
    }

    if (strength.score < 3) {
      setError(t("auth.signUp.strongerPassword"))
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName,
          companyName,
          plan,
        }),
      })

      const result = await response.json().catch(() => ({ error: t("auth.signUp.invalidResponse") }))

      if (!response.ok) {
        throw new Error(result.error || t("auth.signUp.failedToCreate"))
      }

      router.push(`/auth/sign-up-success?email=${encodeURIComponent(email)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.signUp.failedToCreate"))
      setIsLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true)
    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/` },
    })
    // On success the browser navigates away to Google immediately -- this
    // only returns for us to handle if the request itself failed to start.
    if (oauthError) {
      setError(oauthError.message)
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-4">
      <AuroraBackground />

      <Card className="w-full max-w-md relative bg-card/80 backdrop-blur-xl border-border/50">
        <CardHeader className="text-center">
          <AnimatedGroup className="space-y-2">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Logo size="lg" />
            </div>
            <CardTitle className="text-2xl">{t("auth.signUp.title")}</CardTitle>
            <CardDescription>
              {t("auth.signUp.description")}
            </CardDescription>
          </AnimatedGroup>
        </CardHeader>
        <form onSubmit={handleSignUp}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              className="w-full h-12 gap-3 border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all"
              onClick={handleGoogleSignUp}
              disabled={isGoogleLoading || isLoading}
            >
              {isGoogleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon />}
              <span className="font-medium">{isGoogleLoading ? t("auth.signUp.creatingAccount") : "Continue with Google"}</span>
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or sign up with email</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">{t("auth.signUp.fullNameLabel")}</Label>
              <Input
                id="fullName"
                type="text"
                placeholder={t("auth.signUp.fullNamePlaceholder")}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">{t("auth.signUp.companyNameLabel")}</Label>
              <Input
                id="companyName"
                type="text"
                placeholder={t("auth.signUp.companyNamePlaceholder")}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.signUp.emailLabel")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("auth.signUp.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-secondary/50"
              />
            </div>

            {/* Password with strength indicator */}
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.signUp.passwordLabel")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.signUp.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="bg-secondary/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? t("auth.signUp.hidePassword") : t("auth.signUp.showPassword")}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Strength meter */}
              {password.length > 0 && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          i <= strength.score ? strength.color : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${
                    strength.score >= 4 ? "text-green-500" : 
                    strength.score >= 3 ? "text-amber-500" : "text-destructive"
                  }`}>
                    {strength.label}
                  </p>

                  {/* Requirement checklist */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { check: strength.checks.length, label: t("auth.signUp.lengthReq") },
                      { check: strength.checks.uppercase, label: t("auth.signUp.uppercaseReq") },
                      { check: strength.checks.lowercase, label: t("auth.signUp.lowercaseReq") },
                      { check: strength.checks.number, label: t("auth.signUp.numberReq") },
                      { check: strength.checks.special, label: t("auth.signUp.specialReq") },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-1.5">
                        {item.check ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <X className="w-3 h-3 text-muted-foreground/50" />
                        )}
                        <span className={`text-xs ${item.check ? "text-green-500" : "text-muted-foreground/50"}`}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("auth.signUp.confirmPasswordLabel")}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder={t("auth.signUp.confirmPasswordPlaceholder")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className={`bg-secondary/50 pr-10 ${
                    passwordsMatch ? "border-green-500/50 focus-visible:ring-green-500/30" : 
                    passwordsMismatch ? "border-destructive/50 focus-visible:ring-destructive/30" : ""
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showConfirmPassword ? t("auth.signUp.hidePassword") : t("auth.signUp.showPassword")}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordsMatch && (
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <Check className="w-3 h-3" /> {t("auth.signUp.passwordsMatch")}
                </p>
              )}
              {passwordsMismatch && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <X className="w-3 h-3" /> {t("auth.signUp.passwordsDoNotMatch")}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || passwordsMismatch || (password.length > 0 && strength.score < 3)}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("auth.signUp.creatingAccount")}
                </>
              ) : (
                t("auth.signUp.startTrial")
              )}
            </Button>

            {/* Security badge */}
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Shield className="w-3 h-3" />
              <span>{t("auth.signUp.encrypted")}</span>
            </div>

            <p className="text-sm text-muted-foreground text-center">
              {t("auth.signUp.alreadyHaveAccount")}{" "}
              <Link href="/auth/login" className="text-primary hover:underline">
                {t("auth.signUp.signIn")}
              </Link>
            </p>
            <p className="text-xs text-muted-foreground text-center">
              {t("auth.signUp.termsAgree")}
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

function SignUpFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<SignUpFallback />}>
      <SignUpForm />
    </Suspense>
  )
}
