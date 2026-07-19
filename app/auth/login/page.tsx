"use client"

import { useState, Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2, Loader2, Eye, EyeOff, Fingerprint, Shield } from "lucide-react"
import { Logo } from "@/components/digit/logo"
import { startAuthentication } from "@simplewebauthn/browser"
import { useI18n } from "@/components/providers/i18n-provider"

function LoginForm() {
  const { t } = useI18n()
  const [email, setEmail] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("digit_remember_email") || ""
    return ""
  })
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(() => typeof window !== "undefined" && !!localStorage.getItem("digit_remember_email"))
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)
  const [passkeyError, setPasskeyError] = useState<string | null>(null)
  const [passkeyAvailable, setPasskeyAvailable] = useState(false)
  const searchParams = useSearchParams()
  const redirect = searchParams?.get("redirect") || "/"
  const errorParam = searchParams?.get("error")
  const reasonParam = searchParams?.get("reason")
  const unconfirmedEmail = errorParam === "email_not_confirmed" ? searchParams?.get("email") || "" : ""
  const justConfirmed = searchParams?.get("confirmed") === "true"
  const displayError = unconfirmedEmail
    ? null
    : errorParam || (reasonParam ? `Auth check failed: ${reasonParam}` : null)
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle")

  const handleResendConfirmation = async () => {
    if (!unconfirmedEmail || resendState === "sending") return
    setResendState("sending")
    try {
      await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unconfirmedEmail }),
      })
    } finally {
      setResendState("sent")
    }
  }

  // Check if WebAuthn is available
  useEffect(() => {
    if (typeof window !== "undefined" && window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()
        .then((available) => setPasskeyAvailable(available))
        .catch(() => setPasskeyAvailable(false))
    }
  }, [])

  const handlePasskeyLogin = async () => {
    setIsPasskeyLoading(true)
    setPasskeyError(null)

    try {
      // 1. Get authentication options from server
      const optionsRes = await fetch("/api/auth/passkeys/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "options" }),
      })
      
      if (!optionsRes.ok) {
        const data = await optionsRes.json()
        throw new Error(data.error || "Failed to start passkey authentication")
      }

      const options = await optionsRes.json()

      // 2. Prompt user for biometric / passkey
      const credential = await startAuthentication({ optionsJSON: options })

      // 3. Verify with server
      const verifyRes = await fetch("/api/auth/passkeys/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", credential }),
      })

      if (!verifyRes.ok) {
        const data = await verifyRes.json()
        throw new Error(data.error || "Passkey verification failed")
      }

      window.location.href = redirect
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setPasskeyError(t("auth.login.passkeyError"))
        } else {
          setPasskeyError(err.message)
        }
      } else {
        setPasskeyError(t("auth.login.passkeyErrorGeneric"))
      }
    } finally {
      setIsPasskeyLoading(false)
    }
  }

  // TODO: re-enable new device verification once email system is configured
  // if (isNewDevice && email) { ... }

  return (
    <Card className="w-full max-w-md relative bg-card/80 backdrop-blur-xl border-border/50">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Logo size="md" />
        </div>
         <CardTitle className="text-2xl">{t("auth.login.welcomeBack")}</CardTitle>
         <CardDescription>{t("auth.login.signInToDashboard")} <span className="text-[10px] opacity-30">v:native</span></CardDescription>
      </CardHeader>
      <form action="/api/auth/login" method="POST">
        <input type="hidden" name="redirect" value={redirect} />
        <CardContent className="space-y-4">
          {justConfirmed && !displayError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {t("auth.login.emailConfirmed")}
            </div>
          )}

          {displayError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {displayError}
            </div>
          )}

          {unconfirmedEmail && (
            <div className="space-y-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {t("auth.login.emailNotConfirmed")}
              </div>
              {resendState === "sent" ? (
                <p className="text-muted-foreground">{t("auth.login.resendSent")}</p>
              ) : (
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resendState === "sending"}
                  className="text-primary hover:underline text-sm font-medium"
                >
                  {resendState === "sending" ? t("auth.login.resending") : t("auth.login.resendConfirmation")}
                </button>
              )}
            </div>
          )}

          {/* Passkey / Biometric Login */}
          {passkeyAvailable && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 gap-3 border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-all"
                onClick={handlePasskeyLogin}
                disabled={isPasskeyLoading}
              >
                {isPasskeyLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Fingerprint className="w-5 h-5 text-primary" />
                )}
                 <span className="font-medium">
                   {isPasskeyLoading ? t("auth.login.authenticating") : t("auth.login.signInWithPasskey")}
                 </span>
              </Button>

              {passkeyError && (
                <div className="flex items-center gap-2 text-sm text-destructive" role="alert">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {passkeyError}
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">{t("auth.login.orContinueWithEmail")}</span>
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
             <Label htmlFor="email">{t("auth.login.email")}</Label>
             <Input
               id="email"
               name="email"
               type="email"
               placeholder={t("auth.login.emailPlaceholder")}
               value={email}
               onChange={(e) => setEmail(e.target.value)}
               required
               className="bg-secondary/50"
             />
          </div>
          <div className="space-y-2">
             <Label htmlFor="password">{t("auth.login.password")}</Label>
             <div className="relative">
               <Input
                 id="password"
                 name="password"
                 type={showPassword ? "text" : "password"}
                 placeholder={t("auth.login.passwordPlaceholder")}
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 required
                 className="bg-secondary/50 pr-10"
               />
               <button
                 type="button"
                 onClick={() => setShowPassword(!showPassword)}
                 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                 aria-label={showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
               >
                 {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
               </button>
             </div>
          </div>

          {/* Remember Me */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
            />
             <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground cursor-pointer">
               {t("auth.login.rememberMe")}
             </Label>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
           <Button type="submit" className="w-full">
             {t("auth.login.signIn")}
           </Button>

          {/* Security badge */}
           <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
             <Shield className="w-3 h-3" />
             <span>{t("auth.login.protectedBySecurity")}</span>
           </div>

           <p className="text-sm text-muted-foreground text-center">
             {t("auth.login.dontHaveAccount")}{" "}
             <Link href="/auth/sign-up" className="text-primary hover:underline">
               {t("auth.login.signUp")}
             </Link>
           </p>
        </CardFooter>
      </form>
    </Card>
  )
}

function LoginFormFallback() {
  return (
    <Card className="w-full max-w-md relative bg-card/80 backdrop-blur-xl border-border/50">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Logo size="md" />
        </div>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your enterprise dashboard</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,212,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,212,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
