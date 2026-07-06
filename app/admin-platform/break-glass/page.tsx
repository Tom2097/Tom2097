"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ShieldAlert, Clock, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { requestBreakGlassAccess, getActiveBreakGlassSession } from "@/lib/auth/break-glass"

const MAX_BREAK_GLASS_MINUTES = 30 // Auto-expire after 30 minutes

export default function BreakGlassPage() {
  const router = useRouter()
  const [reason, setReason] = useState("")
  const [duration, setDuration] = useState(MAX_BREAK_GLASS_MINUTES)
  const [isLoading, setIsLoading] = useState(false)
  const [activeSession, setActiveSession] = useState<{ expiresAt: string } | null>(null)

  useEffect(() => {
    const checkActiveSession = async () => {
      const session = await getActiveBreakGlassSession()
      if (session) {
        setActiveSession(session)
      }
    }
    checkActiveSession()
  }, [])

  const handleRequestAccess = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for break-glass access")
      return
    }

    if (duration < 1 || duration > MAX_BREAK_GLASS_MINUTES) {
      toast.error(`Duration must be between 1 and ${MAX_BREAK_GLASS_MINUTES} minutes`)
      return
    }

    setIsLoading(true)
    try {
      const result = await requestBreakGlassAccess(reason, duration)
      if (result.success) {
        toast.success("Break-glass access granted")
        router.refresh()
      } else {
        toast.error(result.error || "Failed to request break-glass access")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleEndSession = async () => {
    setIsLoading(true)
    try {
      const result = await fetch("/api/v1/admin/break-glass", {
        method: "DELETE",
      })
      const data = await result.json()
      if (data.success) {
        toast.success("Break-glass session ended")
        setActiveSession(null)
      } else {
        toast.error(data.error || "Failed to end session")
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (activeSession) {
    return (
      <Card className="max-w-2xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            Active Break-Glass Session
          </CardTitle>
          <CardDescription>
            Emergency access is active. This session will auto-expire.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              All actions are being logged and monitored. Misuse will result in immediate revocation.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="font-medium">Expires At:</span>
              <span>{new Date(activeSession.expiresAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Time Remaining:</span>
              <span>
                {Math.max(0, Math.floor((new Date(activeSession.expiresAt).getTime() - Date.now()) / 60000))} minutes
              </span>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="destructive" onClick={handleEndSession} disabled={isLoading}>
            {isLoading ? "Ending..." : "End Session Immediately"}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-red-500" />
          Request Break-Glass Access
        </CardTitle>
        <CardDescription>
          Emergency access for critical operations. All actions are logged and alarmed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>
            Break-glass access is for emergencies only. Unauthorized use is strictly prohibited.
          </AlertDescription>
        </Alert>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Emergency Access</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the emergency situation..."
              rows={4}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="duration"
                type="number"
                min="1"
                max={MAX_BREAK_GLASS_MINUTES}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-24"
              />
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-500">
                Max {MAX_BREAK_GLASS_MINUTES} minutes
              </span>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleRequestAccess} disabled={isLoading}>
          {isLoading ? "Requesting..." : "Request Emergency Access"}
        </Button>
      </CardFooter>
    </Card>
  )
}