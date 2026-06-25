"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Loader2, Eye, EyeOff, CheckCircle2, ArrowLeft, Check } from "lucide-react"
import { Logo } from "@/components/digit/logo"

function PasswordStrengthMeter({ password }: { password: string }) {
  const getStrength = () => {
    let strength = 0
    if (password.length >= 8) strength++
    if (password.length >= 12) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++
    return strength
  }

  const strength = getStrength()
  const strengthText = ["Very Weak", "Weak", "Fair", "Good", "Strong", "Very Strong"]
  const strengthColor = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-blue-500", "bg-green-500", "bg-green-600"]

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Password Strength</span>
        <span className={`text-xs font-medium ${strength >= 4 ? "text-green-600" : strength >= 2 ? "text-yellow-600" : "text-red-600"}`}>
          {strengthText[strength]}
        </span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full transition-all ${strengthColor[strength]} w-0`} style={{ width: `${(strength / 5) * 100}%` }} />
      </div>
      <ul className="text-xs text-muted-foreground space-y-1">
        <li className="flex items-center gap-1">
          {password.length >= 8 ? <Check className="w-3 h-3 text-green-600" /> : <div className="w-3 h-3" />}
          At least 8 characters
        </li>
        <li className="flex items-center gap-1">
          {/[A-Z]/.test(password) ? <Check className="w-3 h-3 text-green-600" /> : <div className="w-3 h-3" />}
          One uppercase letter
        </li>
        <li className="flex items-center gap-1">
          {/[0-9]/.test(password) ? <Check className="w-3 h-3 text-green-600" /> : <div className="w-3 h-3" />}
          One number
        </li>
        <li className="flex items-center gap-1">
          {/[^A-Za-z0-9]/.test(password) ? <Check className="w-3 h-3 text-green-600" /> : <div className="w-3 h-3" />}
          One special character
        </li>
      </ul>
    </div>
  )
}

function ResetPasswordForm() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isResetComplete, setIsResetComplete] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check if user has a valid reset session
    const checkSession = async () => {
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        setError("Invalid or expired reset link. Please request a new one.")
      }
    }
    checkSession()
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (password.length < 8) {
      setError("Password must be at least 8 characters long")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match")
      return
    }

    setIsLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setIsLoading(false)
    } else {
      setIsResetComplete(true)
      setTimeout(() => {
        router.push("/auth/login")
      }, 2000)
    }
  }

  return (
    <>
      {!isResetComplete ? (
        <Card className="w-full max-w-md relative bg-card/80 backdrop-blur-xl border-border/50">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Logo size="md" />
            </div>
            <CardTitle className="text-2xl">Create New Password</CardTitle>
            <CardDescription>Make sure to use a strong and unique password</CardDescription>
          </CardHeader>
          <form onSubmit={handleReset}>
            <CardContent className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-secondary/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {password && <PasswordStrengthMeter password={password} />}

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="bg-secondary/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || password.length < 8 || password !== confirmPassword}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : (
        <Card className="w-full max-w-md relative bg-card/80 backdrop-blur-xl border-border/50">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
              </div>
            </div>
            <CardTitle className="text-2xl">Password Reset</CardTitle>
            <CardDescription>Your password has been successfully reset</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
              Redirecting to login page...
            </p>
          </CardContent>
        </Card>
      )}
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,212,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,212,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <Suspense fallback={<Loader2 className="w-8 h-8 animate-spin" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
