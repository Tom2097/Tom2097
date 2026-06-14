# Module #9: Subscription & Billing (Razorpay + Stripe)

## Overview
Module #9 extends the subscription management infrastructure with dual payment provider support (Razorpay + Stripe), org-scoped billing events, and a production-ready billing API backend.

## Implementation

### Schema
- **Extended `subscriptions` table** with Razorpay fields: `razorpay_subscription_id`, `razorpay_customer_id`, `razorpay_payment_method`
- **New `billing_events` table**: Org-scoped audit trail for all billing transactions (payments, subscription events, failures)
- **RLS policies**: `billing_events_select_admin` allows admin members of each org to read their org's billing history
- **Permissions**: Added `billing:create`, `billing:manage`, `billing:view` granted to system 'admin' roles

### Library Layer (`lib/billing/`)
- **types.ts**: Subscription/plan/event types, session inputs, webhook event types
- **stripe.ts**: Org-scoped session creation, plan updates, cancellations; webhook event handlers for customer.subscription.* and invoice.payment.* events
- **razorpay.ts**: Org-scoped session creation, plan updates, cancellations; webhook handler for subscription.* and payment.* events; HMAC signature verification

### API Routes (`/api/v1/billing/`)
- **POST `/create-session`**: Create a Stripe or Razorpay checkout session for the caller's org (requires auth, no extra permission)
- **POST `/webhook-stripe`**: Stripe webhook endpoint; verifies signature, handles subscription + payment events
- **POST `/webhook-razorpay`**: Razorpay webhook endpoint; verifies HMAC signature, handles subscription + payment events
- **GET/PATCH/DELETE `/subscriptions`**: List (billing:view), update plan (billing:manage), cancel (billing:manage); all org-scoped
- **GET `/history`**: Fetch paginated billing events for org (billing:view); filterable by provider

### Audit Events
Added 6 new audit actions: `billing.session_created`, `billing.subscription_created`, `billing.subscription_updated`, `billing.subscription_cancelled`, `billing.payment_completed`, `billing.payment_failed`

## Compatibility

- **Multi-tenant**: All operations org-scoped via session context; no cross-org data leakage
- **Supabase Auth**: Reuses `withAuth`, `hasPermission`, `logAuthEvent` from existing auth infrastructure
- **Existing schemas**: Additive only; extended `subscriptions` table with nullable Razorpay fields; new `billing_events` table
- **No module redesigns**: Existing `app/actions/payment.ts` and `lib/stripe.ts` remain untouched; Module #9 adds a backend-first API layer

## Security

- **Webhook signature verification**: Stripe (ECDSA) and Razorpay (HMAC) both validated server-side
- **Permission checks**: All routes enforce `billing:view/manage` via `hasPermission` RPC
- **RLS**: `billing_events` readable only by org admins; `subscriptions` readable by organization-scoped queries
- **Audit trail**: All billing actions logged to `audit_logs` table for compliance

## Files

- `lib/auth/audit.ts`: Added 6 billing audit actions
- `lib/billing/types.ts`: Types (73 lines)
- `lib/billing/stripe.ts`: Stripe engine (264 lines)
- `lib/billing/razorpay.ts`: Razorpay engine (282 lines)
- `app/api/v1/billing/create-session/route.ts`: Session creation
- `app/api/v1/billing/webhook-stripe/route.ts`: Stripe webhook
- `app/api/v1/billing/webhook-razorpay/route.ts`: Razorpay webhook
- `app/api/v1/billing/subscriptions/route.ts`: Subscription CRUD (159 lines)
- `app/api/v1/billing/history/route.ts`: Billing history
