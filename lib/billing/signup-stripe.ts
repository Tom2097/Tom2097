import "server-only"
import { getStripe } from "@/lib/stripe"
import { createServiceClient } from "@/lib/supabase/service"
import { MONTHLY_PRICE_CENTS } from "@/lib/products"

/**
 * Gets or creates the Stripe customer for an org, reusing the same
 * per-org idempotency key convention app/actions/stripe.ts's
 * createCheckoutSession already established, so a double-submit can never
 * create two Stripe customers for one org.
 */
export async function getOrCreateStripeCustomer(
  organizationId: string,
  email: string | undefined,
): Promise<string> {
  const db = createServiceClient()
  const { data: sub } = await db
    .from("subscriptions")
    .select("id, stripe_customer_id")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (sub?.stripe_customer_id) return sub.stripe_customer_id as string

  const stripe = await getStripe()
  const customer = await stripe.customers.create(
    { email, metadata: { organization_id: organizationId } },
    { idempotencyKey: `stripe-customer-${organizationId}` },
  )

  if (sub) {
    await db.from("subscriptions").update({ stripe_customer_id: customer.id }).eq("id", sub.id)
  } else {
    await db
      .from("subscriptions")
      .insert({ organization_id: organizationId, stripe_customer_id: customer.id, plan_id: "digit_annual", status: "pending" })
  }

  return customer.id
}

/**
 * Spec section 1, step 3: "run an authorization / mandate setup -- verify
 * the method is valid and chargeable, take zero money." A SetupIntent is
 * the correct Stripe primitive for exactly this, regardless of which
 * payment method type the customer picks in Stripe's Payment Element
 * (card, Apple Pay, Google Pay, SEPA Direct Debit all go through the same
 * SetupIntent -- SEPA's mandate is created automatically on confirmation).
 * usage: "off_session" is what makes the later trial-end charge possible
 * without the customer present.
 */
export async function createSetupIntentForOrg(
  organizationId: string,
  email: string | undefined,
): Promise<{ clientSecret: string | null; customerId: string }> {
  const customerId = await getOrCreateStripeCustomer(organizationId, email)
  const stripe = await getStripe()
  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    usage: "off_session",
    metadata: { organization_id: organizationId },
  })
  return { clientSecret: setupIntent.client_secret, customerId }
}

/**
 * Spec section 1, step 3->4: verifies the SetupIntent the client just
 * confirmed actually succeeded (never trust a browser redirect alone --
 * this re-checks with Stripe directly), stores only the provider's token
 * (never raw card data), and sets it as the customer's default payment
 * method for the off-session charge at trial end.
 */
export async function confirmSetupIntentAndSavePaymentMethod(
  organizationId: string,
  setupIntentId: string,
): Promise<{ paymentMethodId: string; type: string; last4: string | null } | null> {
  const stripe = await getStripe()
  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId, { expand: ["payment_method"] })
  if (setupIntent.status !== "succeeded") return null

  const pm = setupIntent.payment_method
  if (!pm || typeof pm === "string") return null
  if (setupIntent.metadata?.organization_id !== organizationId) return null // guard against a foreign setup_intent id

  const last4 = pm.card?.last4 ?? pm.sepa_debit?.last4 ?? null

  const db = createServiceClient()
  await db.from("payment_methods").insert({
    organization_id: organizationId,
    provider: "stripe",
    provider_token: pm.id,
    type: pm.type,
    last4,
    exp_month: pm.card?.exp_month ?? null,
    exp_year: pm.card?.exp_year ?? null,
    is_default: true,
  })

  await stripe.customers.update(setupIntent.customer as string, {
    invoice_settings: { default_payment_method: pm.id },
  })

  return { paymentMethodId: pm.id, type: pm.type, last4 }
}

/**
 * Stripe's Subscription price_data requires a real Product id (unlike a
 * one-off Checkout line item, which accepts inline product_data) -- looked
 * up by a stable metadata tag rather than created fresh every signup, so
 * repeat monthly signups all land on the same Product instead of spawning
 * a new one each time. products.list is a strongly-consistent read (unlike
 * the search API, which can lag ~1min behind a just-created object), so
 * the only realistic race is two *simultaneous* first-ever monthly
 * signups both creating one -- harmless (a stray extra Product, not a
 * stray extra charge), and self-corrects on the next signup either way.
 */
async function getOrCreateDigitProductId(stripe: Awaited<ReturnType<typeof getStripe>>): Promise<string> {
  const existing = await stripe.products.list({ active: true, limit: 100 })
  const found = existing.data.find((p) => p.metadata?.app === "digit_monthly")
  if (found) return found.id
  const product = await stripe.products.create({ name: "DigiT", metadata: { app: "digit_monthly" } })
  return product.id
}

/**
 * Creates a real, Stripe-managed recurring monthly Subscription -- unlike
 * the annual plan (a manual PaymentIntent charged once at trial end by
 * lib/billing/charge.ts's chargeAllDueTrials sweep), "cancel anytime"
 * monthly billing needs Stripe's own subscription lifecycle: automatic
 * monthly invoicing, retries on failed payment, and self-serve
 * cancellation (already wired in lib/billing/subscription-lifecycle.ts's
 * cancelSubscription()). trial_end mirrors the trialEndsAt this org's
 * subscriptions row was just given by activateTrial(), so Stripe's own
 * trial and this app's DB-tracked trial end at the same instant. The
 * `metadata.organization_id` is required -- app/api/webhooks/stripe/route.ts's
 * customer.subscription.updated/deleted and invoice.paid/payment_failed
 * handlers key off it to find which org a given Stripe event belongs to.
 */
export async function createMonthlyStripeSubscription(
  organizationId: string,
  customerId: string,
  paymentMethodId: string,
  trialEndsAt: Date,
): Promise<string> {
  const stripe = await getStripe()
  const productId = await getOrCreateDigitProductId(stripe)
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [
      {
        price_data: {
          currency: "usd",
          product: productId,
          unit_amount: MONTHLY_PRICE_CENTS,
          recurring: { interval: "month" },
        },
      },
    ],
    default_payment_method: paymentMethodId,
    trial_end: Math.floor(trialEndsAt.getTime() / 1000),
    metadata: { organization_id: organizationId },
  })
  return subscription.id
}
