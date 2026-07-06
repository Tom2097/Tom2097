"use client"

import { useState, Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Loader2, Eye, EyeOff, Fingerprint, Shield, ArrowLeft, Key } from "lucide-react"
import { Logo } from "@/components/digit/logo"
import { startAuthentication } from "@simplewebauthn/browser"
import { SUPPORTED_PROVIDERS } from "@/lib/auth/oauth/types"
import { toast } from "sonner"

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
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [magicLinkLoading, setMagicLinkLoading] = useState(false)
  const [hasWebAuthnCredentials, setHasWebAuthnCredentials] = useState<boolean | null>(null)
  const [isNewDevice, setIsNewDevice] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams?.get("redirect") || "/"

  // Check if WebAuthn is available and if user has credentials
  useEffect(() => {
    if (typeof window !== "undefined" && window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()
        .then((available) => setPasskeyAvailable(available))
        .catch(() => setPasskeyAvailable(false))
    }
    
    // Check if user has WebAuthn credentials
    const checkWebAuthnCredentials = async () => {
      try {
        const response = await fetch(`/api/v1/auth/webauthn/has-credentials?email=${encodeURIComponent(email)}`)
        if (response.ok) {
          const data = await response.json()
          setHasWebAuthnCredentials(data.hasCredentials)
          setIsNewDevice(!data.hasCredentials)
        }
      } catch {
        setHasWebAuthnCredentials(false)
      }
    }
    
    if (email) {
      checkWebAuthnCredentials()
    }
  }, [email])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Handle remember me
    if (rememberMe) {
      localStorage.setItem("digit_remember_email", email)
    } else {
      localStorage.removeItem("digit_remember_email")
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error instanceof Error ? error.message : "Failed to login")
      setIsLoading(false)
    } else {
      router.push(redirect)
      router.refresh()
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

      router.push(redirect)
      router.refresh()
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

  if (isNewDevice && email) {
    return (
      <Card className="w-full max-w-md relative bg-card/80 backdrop-blur-xl border-border/50">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Logo size="md" />
          </div>
          <CardTitle className="text-2xl">New Device Detected</CardTitle>
          <CardDescription>This device is not recognized</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <div className="flex items-center justify-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm">This device is not registered for your account.</p>
          </div>
          <p className="text-sm text-muted-foreground">
            You can sign in with a linked SSO provider or re-enroll this device.
          </p>
          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 gap-2"
              onClick={() => setIsNewDevice(false)}
            >
              <ArrowLeft className="w-4 h-4" /> Back to Sign In
            </Button>
            <Button
              type="button"
              className="w-full h-12 gap-2 bg-primary hover:bg-primary/90"
              onClick={async () => {
                setIsLoading(true)
                try {
                  // Send a fresh one-time passcode to the user's email
                  const response = await fetch("/api/v1/auth/passwordless/request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                  })
                  if (!response.ok) throw new Error("Failed to send passcode")
                  
                  toast.success("New passcode sent to your email")
                  setIsNewDevice(false) // Go back to sign in to enter the new passcode
                } catch (err) {
                  toast.error("Failed to send passcode. Please try again.")
                } finally {
                  setIsLoading(false)
                }
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Key className="w-4 h-4" />
              )}
              Send New Passcode
            </Button>
            <Button
              type="button"
              className="w-full h-12 gap-2 bg-secondary hover:bg-secondary/90"
              onClick={() => router.push(`/secure-onboarding?email=${encodeURIComponent(email)}`)}
            >
              <Key className="w-4 h-4" /> Re-enroll This Device
            </Button>
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or sign in with SSO</span>
            </div>
          </div>
          <div className="flex justify-center gap-4">
            {Object.entries(SUPPORTED_PROVIDERS).map(([providerId, config]) => (
              config.enabled && !providerId.includes("azure") && (
                <form
                  key={providerId}
                  action={`/api/v1/auth/oauth/${providerId}`}
                  method="POST"
                >
                  <input type="hidden" name="redirect" value={redirect} />
                  <Button
                    type="submit"
                    variant="outline"
                    size="icon"
                    className="w-10 h-10 p-0 rounded-full"
                    title={`Sign in with ${config.name.replace("'", "&apos;")}`}
                  >
                    <img
                      src={`/icons/oauth/${providerId}.svg`}
                      alt={config.name}
                      className="w-5 h-5"
                    />
                  </Button>
                </form>
              )
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

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

          {/* Magic Link */}
          {!magicLinkSent && (
            <>
              <Button
                type="button"
                variant="ghost"
                className="w-full h-12 gap-2 text-muted-foreground hover:text-foreground"
                onClick={async () => {
                  if (!email) { setError("Enter your email first"); return }
                  setMagicLinkLoading(true)
                  setError(null)
                  try {
                    const res = await fetch("/api/auth/passwordless/send", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email }),
                    })
                    if (!res.ok) {
                      const data = await res.json()
                      throw new Error(data.error || "Failed to send magic link")
                    }
                    setMagicLinkSent(true)
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to send magic link")
                  } finally {
                    setMagicLinkLoading(false)
                  }
                }}
                disabled={magicLinkLoading}
              >
                {magicLinkLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                <span>Sign in with magic link (no password)</span>
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>
            </>
          )}

          {magicLinkSent && (
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
              <p className="text-sm font-medium text-foreground">Magic link sent!</p>
              <p className="text-xs text-muted-foreground mt-1">
                Check your email at <strong>{email}</strong> for the sign-in link.
              </p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setMagicLinkSent(false)}>
                Use password instead
              </Button>
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
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link 
                href="/auth/forgot-password" 
                className="text-xs text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
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
