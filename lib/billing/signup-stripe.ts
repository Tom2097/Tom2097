import "server-only"
import { getStripe } from "@/lib/stripe"
import { createServiceClient } from "@/lib/supabase/service"

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
