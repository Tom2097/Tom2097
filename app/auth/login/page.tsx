"use client"

import { useState, Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Loader2, Eye, EyeOff, Fingerprint, Shield } from "lucide-react"
import { Logo } from "@/components/digit/logo"
import { startAuthentication } from "@simplewebauthn/browser"

function LoginForm() {
  const [email, setEmail] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("digit_remember_email") || ""
    return ""
  })
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(() => typeof window !== "undefined" && !!localStorage.getItem("digit_remember_email"))
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)
  const [passkeyAvailable, setPasskeyAvailable] = useState(false)
  const searchParams = useSearchParams()
  const redirect = searchParams?.get("redirect") || "/"

  // Check if WebAuthn is available
  useEffect(() => {
    if (typeof window !== "undefined" && window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()
        .then((available) => setPasskeyAvailable(available))
        .catch(() => setPasskeyAvailable(false))
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (rememberMe) {
      localStorage.setItem("digit_remember_email", email)
    } else {
      localStorage.removeItem("digit_remember_email")
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Login failed")
      }

      window.location.href = redirect
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to login")
      setIsLoading(false)
    }
  }

  const handlePasskeyLogin = async () => {
    setIsPasskeyLoading(true)
    setError(null)

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
          setError("Passkey authentication was canceled.")
        } else {
          setError(err.message)
        }
      } else {
        setError("An unexpected error occurred.")
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
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your enterprise dashboard</CardDescription>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
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
                disabled={isPasskeyLoading || isLoading}
              >
                {isPasskeyLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Fingerprint className="w-5 h-5 text-primary" />
                )}
                <span className="font-medium">
                  {isPasskeyLoading ? "Authenticating..." : "Sign in with Face ID / Passkey"}
                </span>
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-secondary/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-secondary/50 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
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
              Remember me
            </Label>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isLoading || isPasskeyLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </Button>

          {/* Security badge */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="w-3 h-3" />
            <span>Protected by enterprise-grade security</span>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Don&apos;t have an account?{" "}
            <Link href="/auth/sign-up" className="text-primary hover:underline">
              Sign up
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
