import "server-only"

// Lazy load Stripe to avoid build-time evaluation
let stripeInstance: Promise<import('stripe').default> | null = null

export async function getStripe() {
  if (!stripeInstance) {
    const Stripe = await import('stripe')
    const StripeClass = Stripe.default || Stripe
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    
    if (!stripeSecretKey) {
      throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.")
    }
    
    stripeInstance = Promise.resolve(
      new (Stripe.default || Stripe)(
        stripeSecretKey,
        {
          apiVersion: "2025-08-27.basil",
          typescript: true,
        }
      )
    )
  }
  
  return stripeInstance
}

// For backward compatibility, export a null stripe that will be initialized on first use
export const stripe = null as unknown as import('stripe').default
