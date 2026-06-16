import "server-only"
import Stripe from "stripe"

// Only initialize Stripe if the secret key is available
// This prevents build errors when the env var is not set
const stripeSecretKey = process.env.STRIPE_SECRET_KEY

export const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.basil",
      typescript: true,
    })
  : null as unknown as Stripe // Type assertion for build time

export function getStripe(): Stripe {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.")
  }
  return stripe
}
