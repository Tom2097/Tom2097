"use server"

import { getStripe } from "@/lib/stripe"
import { createClient } from "@/lib/supabase/server"

/**
 * Look up which plan a Checkout Session was for, from the `session_id`
 * Stripe substitutes into `success_url` (see createCheckoutSession above).
 * Used by the checkout success page to know what purchase to expect while
 * it polls the `subscriptions` row for the (asynchronous, webhook-driven)
 * update to land -- without this, the success page has no way to tell "the
 * webhook hasn't landed yet" apart from "nothing happened".
 *
 * Re-checks the session's organization_id against the caller's own org so a
 * guessed/foreign session_id can't be used to peek at another org's plan.
 */
export async function getCheckoutSessionPlanId(sessionId: string): Promise<string | null> {
  if (!sessionId) return null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single()
  if (!profile?.organization_id) return null

  try {
    const stripe = await getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.metadata?.organization_id !== profile.organization_id) return null
    return session.metadata?.plan_id ?? null
  } catch {
    return null
  }
}

export async function createBillingPortalSession() {
  const stripe = await getStripe()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("You must be logged in")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id) {
    throw new Error("No organization found")
  }

  // Owner-only: the billing portal exposes payment methods, invoices, and
  // cancellation -- see createCheckoutSession()'s matching check above.
  if (profile.role !== "owner") {
    throw new Error("Only the organization owner can manage billing")
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("organization_id", profile.organization_id)
    .single()

  if (!subscription?.stripe_customer_id) {
    throw new Error("No billing account found")
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/settings`,
    })

    return { url: session.url }
  } catch (err: any) {
    if (err?.code === "resource_missing" || err?.raw?.code === "resource_missing") {
      // Stripe customer no longer exists (e.g. test/live mode mismatch) — clear the
      // stale reference so the UI falls back to the "Upgrade Plan" state.
      await supabase
        .from("subscriptions")
        .update({ stripe_customer_id: null })
        .eq("organization_id", profile.organization_id)
      throw new Error("Your billing account could not be found. Please start a new subscription.")
    }
    throw err
  }
}
