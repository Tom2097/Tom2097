// Type definitions for Stripe.js
// Minimal declarations for Stripe usage

declare module 'stripe' {
  namespace Stripe {
    interface StripeConfig {
      apiVersion?: string
      typescript?: boolean
    }

    interface StripeConstructor {
      new (apiKey: string, config?: StripeConfig): Stripe
    }

    interface Stripe {
      customers: {
        create(params: CustomerCreateParams): Promise<Customer>
        retrieve(id: string): Promise<Customer>
        update(id: string, params: CustomerUpdateParams): Promise<Customer>
        list(params?: CustomerListParams): Promise<{ data: Customer[] }>
      }

      subscriptions: {
        create(params: SubscriptionCreateParams): Promise<Subscription>
        retrieve(id: string): Promise<Subscription>
        update(id: string, params: SubscriptionUpdateParams): Promise<Subscription>
        cancel(id: string): Promise<Subscription>
        list(params?: SubscriptionListParams): Promise<{ data: Subscription[] }>
      }

      checkout: {
        sessions: {
          create(params: CheckoutSessionCreateParams): Promise<CheckoutSession>
        }
      }

      invoices: {
        create(params: InvoiceCreateParams): Promise<Invoice>
        retrieve(id: string): Promise<Invoice>
        finalizeInvoice(id: string): Promise<Invoice>
        sendInvoice(id: string): Promise<Invoice>
        voidInvoice(id: string): Promise<Invoice>
        list(params?: InvoiceListParams): Promise<{ data: Invoice[] }>
      }

      paymentIntents: {
        create(params: PaymentIntentCreateParams): Promise<PaymentIntent>
        retrieve(id: string): Promise<PaymentIntent>
        update(id: string, params: PaymentIntentUpdateParams): Promise<PaymentIntent>
        confirm(id: string, params?: PaymentIntentConfirmParams): Promise<PaymentIntent>
        capture(id: string, params?: PaymentIntentCaptureParams): Promise<PaymentIntent>
        cancel(id: string, params?: PaymentIntentCancelParams): Promise<PaymentIntent>
      }

      prices: {
        create(params: PriceCreateParams): Promise<Price>
        retrieve(id: string): Promise<Price>
        list(params?: PriceListParams): Promise<{ data: Price[] }>
      }

      products: {
        create(params: ProductCreateParams): Promise<Product>
        retrieve(id: string): Promise<Product>
        update(id: string, params: ProductUpdateParams): Promise<Product>
        list(params?: ProductListParams): Promise<{ data: Product[] }>
      }

      webhooks: {
        constructEvent(payload: string, header: string, secret: string): Stripe.Event
      }
    }

    // Minimal interfaces for common Stripe objects
    interface Customer {
      id: string
      email?: string
      name?: string
      metadata?: Record<string, string>
    }

    interface Subscription {
      id: string
      customer: string
      status: string
      current_period_end: number
      items: {
        data: Array<{
          price: {
            id: string
            product: string
          }
        }>
      }
    }

    interface CheckoutSession {
      id: string
      url?: string
      payment_status: string
      status: string
    }

    interface Invoice {
      id: string
      customer: string
      status: string
      amount_due: number
      hosted_invoice_url?: string
    }

    interface PaymentIntent {
      id: string
      client_secret?: string
      status: string
      amount: number
      currency: string
    }

    interface Price {
      id: string
      product: string
      unit_amount: number
      currency: string
      recurring?: {
        interval: 'day' | 'week' | 'month' | 'year'
      }
    }

    interface Product {
      id: string
      name: string
      description?: string
    }

    interface Event {
      id: string
      type: string
      data: {
        object: unknown
      }
    }

    // Minimal parameter interfaces
    interface CustomerCreateParams {
      email?: string
      name?: string
      metadata?: Record<string, string>
    }

    interface CustomerUpdateParams {
      email?: string
      name?: string
      metadata?: Record<string, string>
    }

    interface CustomerListParams {
      limit?: number
      email?: string
    }

    interface SubscriptionCreateParams {
      customer: string
      items: Array<{
        price: string
      }>
      trial_end?: number | 'now'
    }

    interface SubscriptionUpdateParams {
      cancel_at_period_end?: boolean
      items?: Array<{
        id: string
        price?: string
      }>
    }

    interface SubscriptionListParams {
      customer?: string
      status?: string
      limit?: number
    }

    interface CheckoutSessionCreateParams {
      customer: string
      payment_method_types: string[]
      line_items: Array<{
        price: string
        quantity: number
      }>
      mode: 'payment' | 'subscription'
      success_url: string
      cancel_url: string
    }

    interface InvoiceCreateParams {
      customer: string
      auto_advance?: boolean
    }

    interface InvoiceListParams {
      customer?: string
      limit?: number
    }

    interface PaymentIntentCreateParams {
      amount: number
      currency: string
      customer?: string
      payment_method_types?: string[]
    }

    interface PaymentIntentUpdateParams {
      amount?: number
      metadata?: Record<string, string>
    }

    interface PaymentIntentConfirmParams {
      payment_method?: string
    }

    interface PaymentIntentCaptureParams {
      amount_to_capture?: number
    }

    interface PaymentIntentCancelParams {
      cancellation_reason?:
        | 'duplicate'
        | 'fraudulent'
        | 'requested_by_customer'
        | 'abandoned'
    }

    interface PriceCreateParams {
      product: string
      unit_amount: number
      currency: string
      recurring?: {
        interval: 'day' | 'week' | 'month' | 'year'
      }
    }

    interface PriceListParams {
      product?: string
      limit?: number
    }

    interface ProductCreateParams {
      name: string
      description?: string
    }

    interface ProductUpdateParams {
      name?: string
      description?: string
    }

    interface ProductListParams {
      limit?: number
    }
  }

  const Stripe: Stripe.StripeConstructor
  export default Stripe
}