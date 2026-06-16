"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Loader2, Zap, Eye, EyeOff, Check, X, Shield } from "lucide-react"

function getPasswordStrength(password: string) {
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

  let label = "Very weak"
  let color = "bg-destructive"
  if (score >= 5) { label = "Very strong"; color = "bg-green-500" }
  else if (score >= 4) { label = "Strong"; color = "bg-green-400" }
  else if (score >= 3) { label = "Fair"; color = "bg-amber-400" }
  else if (score >= 2) { label = "Weak"; color = "bg-orange-500" }

  return { score, checks, label, color }
}

export default function SignUpPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [fullName, setFullName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const strength = useMemo(() => getPasswordStrength(password), [password])
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    if (strength.score < 3) {
      setError("Please choose a stronger password.")
      return
    }

    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // In production, always send users back to the live site's callback.
        // The v0 dev redirect proxy is only used during local/preview development,
        // otherwise the PKCE code-verifier cookie set on this origin won't be
        // present when the code is exchanged, breaking verification.
        emailRedirectTo:
          process.env.NODE_ENV === "development"
            ? (process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
              `${window.location.origin}/auth/callback`)
            : `${window.location.origin}/auth/callback`,
        data: {
          full_name: fullName,
          company_name: companyName,
        },
      },
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
    } else {
      router.push("/auth/sign-up-success")
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,212,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,212,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative bg-card/80 backdrop-blur-xl border-border/50">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-cyan-400 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-cyan-400 rounded-xl blur-lg opacity-50" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
              DigiT
            </span>
          </div>
          <CardTitle className="text-2xl">Start your free trial</CardTitle>
          <CardDescription>14 days free, no credit card required</CardDescription>
        </CardHeader>
        <form onSubmit={handleSignUp}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                type="text"
                placeholder="Acme Inc."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Work Email</Label>
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

            {/* Password with strength indicator */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
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
                  aria-label={showPassword ? "Hide password" : "Show password"}
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
                      { check: strength.checks.length, label: "8+ characters" },
                      { check: strength.checks.uppercase, label: "Uppercase" },
                      { check: strength.checks.lowercase, label: "Lowercase" },
                      { check: strength.checks.number, label: "Number" },
                      { check: strength.checks.special, label: "Special char" },
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
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter your password"
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
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordsMatch && (
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Passwords match
                </p>
              )}
              {passwordsMismatch && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <X className="w-3 h-3" /> Passwords do not match
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
                  Creating account...
                </>
              ) : (
                "Start free trial"
              )}
            </Button>

            {/* Security badge */}
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Shield className="w-3 h-3" />
              <span>Your data is encrypted and secure</span>
            </div>

            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
            <p className="text-xs text-muted-foreground text-center">
              By signing up, you agree to our Terms of Service and Privacy Policy.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
