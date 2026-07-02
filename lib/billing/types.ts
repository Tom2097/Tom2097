import type Stripe from "stripe"

// Subscription plan types
export type SubscriptionPlan = "free" | "pro" | "enterprise"

export interface BillingPlan {
  id: SubscriptionPlan
  name: string
  price: number
  currency: "USD" | "INR"
  billingPeriod: "monthly" | "yearly"
  features: string[]
  stripePriceId?: string
  razorpayPlanId?: string
}

// Subscription database record
export interface SubscriptionRecord {
  id: string
  organization_id: string
  user_id: string
  plan: SubscriptionPlan
  status: "active" | "past_due" | "cancelled" | "incomplete" | "trialing" | "refunded" | "expired"
  current_period_start: string
  current_period_end: string
  trial_ends_at?: string
  billing_interval?: "month" | "year"
  cancel_at_period_end?: boolean
  stripe_customer_id?: string
  stripe_subscription_id?: string
  razorpay_customer_id?: string
  razorpay_subscription_id?: string
  razorpay_payment_method?: string
  cancel_at?: string
  cancelled_at?: string
  created_at: string
  updated_at: string
}

// Billing event record
export interface BillingEvent {
  id: string
  organization_id: string
  subscription_id?: string
  event_type: string
  provider: "stripe" | "razorpay"
  external_id?: string
  amount?: number
  currency: string
  status: "pending" | "completed" | "failed" | "refunded"
  error_message?: string
  metadata: Record<string, unknown>
  created_at: string
}

// Session creation inputs
export interface CreateSessionInput {
  organizationId: string
  userId: string
  plan: SubscriptionPlan
  provider: "stripe" | "razorpay"
  successUrl?: string
  cancelUrl?: string
}

// Webhook payload types (minimal subset for validation)
export interface StripeWebhookEvent {
  type: string
  data: {
    object: Stripe.Customer | Stripe.Subscription | Stripe.Invoice | Record<string, unknown>
  }
}

export interface RazorpayWebhookEvent {
  event: string
  payload: {
    subscription?: {
      entity: {
        id: string
        customer_id: string
        plan_id: string
        status: string
        [key: string]: unknown
      }
    }
    payment?: {
      entity: {
        id: string
        amount: number
        status: string
        [key: string]: unknown
      }
    }
    [key: string]: unknown
  }
}
