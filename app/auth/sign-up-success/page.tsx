import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, LogIn } from "lucide-react"
import { Logo } from "@/components/digit/logo"

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,212,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,212,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative bg-card/80 backdrop-blur-xl border-border/50 text-center">
        <CardHeader>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Logo size="md" />
          </div>
          <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <CardTitle className="text-2xl">Account ready</CardTitle>
          <CardDescription>Your account has been created and is active</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You can now sign in with your email and password to start using the platform.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full gap-2">
            <Link href="/auth/login">
              <LogIn className="w-4 h-4" />
              Sign in
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
