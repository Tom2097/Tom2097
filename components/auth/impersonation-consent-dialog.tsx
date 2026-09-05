"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ShieldAlert } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface PendingRequest {
  id: string
  adminEmail: string | null
  adminName: string | null
  reason: string
  startedAt: string
  expiresAt: string
}

/**
 * Global consent gate for platform-admin impersonation (lib/auth/impersonation.ts).
 * A pending_consent row is otherwise invisible to the target user -- this is
 * the only place that surfaces it and lets them approve or deny.
 */
export function ImpersonationConsentDialog() {
  const [pending, setPending] = useState<PendingRequest | null>(null)
  const [responding, setResponding] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const res = await fetch("/api/v1/me/impersonation-consent")
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data.requests?.length > 0) {
          setPending(data.requests[0])
        }
      } catch {
        // silent -- this is a passive background check, not a blocking load
      }
    }

    check()
    const interval = setInterval(check, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const respond = async (approve: boolean) => {
    if (!pending) return
    setResponding(true)
    try {
      const res = await fetch("/api/v1/me/impersonation-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: pending.id, approve }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(approve ? "Access approved" : "Access denied")
        setPending(null)
      } else {
        toast.error(data.error || "Failed to respond")
      }
    } catch {
      toast.error("Failed to respond")
    } finally {
      setResponding(false)
    }
  }

  if (!pending) return null

  const requester = pending.adminName || pending.adminEmail || "A platform admin"

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            <DialogTitle>Support access request</DialogTitle>
          </div>
          <DialogDescription>
            <strong>{requester}</strong> is requesting temporary access to your account to
            provide support.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border/50 bg-muted/40 p-3 text-sm">
          <p className="text-muted-foreground">Reason given:</p>
          <p className="font-medium text-foreground">{pending.reason}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          If approved, access expires automatically after 1 hour. You can revoke it sooner from
          Settings.
        </p>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" disabled={responding} onClick={() => respond(false)}>
            Deny
          </Button>
          <Button disabled={responding} onClick={() => respond(true)}>
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
