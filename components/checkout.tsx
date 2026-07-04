"use client"

import { useCallback, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js"
import { createCheckoutSession } from "@/app/actions/stripe"

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
)

export interface CheckoutProps {
  planId: string
  discountCode?: string
  onClose?: () => void
}

export function Checkout({ planId, discountCode, onClose }: CheckoutProps) {
  const [error, setError] = useState<string | null>(null)

  const fetchClientSecret = useCallback(async () => {
    try {
      const { clientSecret } = await (createCheckoutSession as any)(planId, discountCode)
      if (!clientSecret) {
        throw new Error("Failed to create checkout session")
      }
      return clientSecret
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout")
      throw err
    }
  }, [planId, discountCode])

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-destructive mb-4">{error}</p>
        <button
          onClick={onClose}
          className="text-sm text-muted-foreground hover:underline"
        >
          Go back
        </button>
      </div>
    )
  }

  return (
    <div id="checkout" className="w-full">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{ fetchClientSecret }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  )
}
