"use client"

import { useState } from "react"
import { 
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Loader2, 
  CreditCard, 
  Lock, 
  AlertCircle,
  CheckCircle2,
  ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { formatPrice } from "@/lib/products"

interface PaymentFormProps {
  planName: string
  priceInCents: number
  onSuccess: () => void
  onError: (error: string) => void
}

export function PaymentForm({ planName, priceInCents, onSuccess, onError }: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [saveCard, setSaveCard] = useState(true)
  const [billingName, setBillingName] = useState("")
  const [billingEmail, setBillingEmail] = useState("")
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success" | "error">("idle")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)
    setPaymentStatus("processing")

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/success`,
          payment_method_data: {
            billing_details: {
              name: billingName,
              email: billingEmail,
            },
          },
        },
        redirect: "if_required",
      })

      if (error) {
        setPaymentStatus("error")
        onError(error.message || "Payment failed")
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        setPaymentStatus("success")
        setTimeout(() => {
          onSuccess()
        }, 1500)
      }
    } catch (err) {
      setPaymentStatus("error")
      onError("An unexpected error occurred")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Payment Status Overlay */}
      <AnimatePresence>
        {paymentStatus === "processing" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl"
          >
            <div className="text-center">
              <div className="relative">
                <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                <motion.div
                  className="absolute inset-0 rounded-full border-4 border-primary/20"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </div>
              <p className="mt-4 text-lg font-medium text-foreground">Processing payment...</p>
              <p className="text-sm text-muted-foreground">Please do not close this window</p>
            </div>
          </motion.div>
        )}

        {paymentStatus === "success" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
              >
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
              </motion.div>
              <p className="mt-4 text-lg font-medium text-foreground">Payment successful!</p>
              <p className="text-sm text-muted-foreground">Redirecting to your dashboard...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Billing Information */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          Billing Information
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="billingName">Full Name</Label>
            <Input
              id="billingName"
              placeholder="John Doe"
              value={billingName}
              onChange={(e) => setBillingName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billingEmail">Email</Label>
            <Input
              id="billingEmail"
              type="email"
              placeholder="john@company.com"
              value={billingEmail}
              onChange={(e) => setBillingEmail(e.target.value)}
              required
            />
          </div>
        </div>
      </div>

      {/* Stripe Payment Element */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Payment Method
        </h3>
        
        <div className="p-4 rounded-xl border border-border bg-muted/30">
          <PaymentElement 
            options={{
              layout: {
                type: "tabs",
                defaultCollapsed: false,
              },
              business: {
                name: "DigiT Enterprise Intelligence",
              },
            }}
          />
        </div>
      </div>

      {/* Save Card Option */}
      <div className="flex items-center space-x-2">
        <Checkbox 
          id="saveCard" 
          checked={saveCard}
          onCheckedChange={(checked) => setSaveCard(checked === true)}
        />
        <label
          htmlFor="saveCard"
          className="text-sm text-muted-foreground cursor-pointer"
        >
          Save this payment method for future purchases
        </label>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={!stripe || !elements || isProcessing}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            Pay {formatPrice(priceInCents)}
            <ChevronRight className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>

      {/* Security Note */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Lock className="w-3 h-3" />
        <span>Your payment is secured with 256-bit SSL encryption</span>
      </div>
    </form>
  )
}
