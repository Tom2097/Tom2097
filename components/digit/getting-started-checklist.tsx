"use client"

import { T } from "@/components/i18n/t"
import { useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { CheckCircle2, Circle, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

export interface OnboardingProgress {
  configured: boolean
  hasContact: boolean
  hasTeammate: boolean
  hasObjective: boolean
}

const DISMISS_KEY = "digit_getting_started_dismissed"

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1"
  } catch {
    return false
  }
}

/**
 * First-run checklist on the dashboard. New workspaces otherwise land on a
 * page of zeros with no hint of what to do first. Each step is derived from
 * real data (see getOnboardingProgress in app/(dashboard)/page.tsx), so it
 * ticks itself off; the card disappears once everything is done or the user
 * dismisses it.
 */
export function GettingStartedChecklist({ progress }: { progress: OnboardingProgress }) {
  // Read the dismissal flag without a setState-in-effect: hidden during SSR
  // and hydration, then the stored value on the client.
  const storedDismissed = useSyncExternalStore(
    () => () => {},
    readDismissed,
    () => true,
  )
  const [dismissedNow, setDismissedNow] = useState(false)
  const dismissed = storedDismissed || dismissedNow

  const steps = [
    { done: progress.configured, href: "/configure", label: <T>Set up your workspace for your industry</T> },
    { done: progress.hasContact, href: "/crm", label: <T>Add your first contact</T> },
    { done: progress.hasTeammate, href: "/settings?tab=team", label: <T>Invite a teammate</T> },
    { done: progress.hasObjective, href: "/performance", label: <T>Set your first objective</T> },
  ]
  const completed = steps.filter((s) => s.done).length

  if (dismissed || completed === steps.length) return null

  const dismiss = () => {
    setDismissedNow(true)
    try {
      localStorage.setItem(DISMISS_KEY, "1")
    } catch {
      // Storage unavailable: hide for this page view only.
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground"><T>Getting started</T></h2>
          <p className="text-sm text-muted-foreground">
            <T>A few steps to get real value from DigiT.</T> {completed}/{steps.length}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Hide getting started checklist">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Progress value={(completed / steps.length) * 100} className="mt-4 h-2" />
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((step) => (
          <li key={step.href}>
            <Link
              href={step.href}
              className="flex items-center gap-3 rounded-lg border border-border/50 px-4 py-3 text-sm transition-colors hover:border-primary/40"
            >
              {step.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className={step.done ? "text-muted-foreground line-through" : "text-foreground"}>
                {step.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
