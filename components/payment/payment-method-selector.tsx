"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { 
  CreditCard, 
  Building2, 
  Wallet,
  Check
} from "lucide-react"
import { cn } from "@/lib/utils"

// Payment method icons as SVGs
const ApplePayIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M17.0425 8.86C16.3975 8.86 15.8675 9.09 15.4675 9.32C15.1525 9.09 14.6075 8.86 13.9625 8.86C12.4425 8.86 11.2375 10.065 11.2375 11.585C11.2375 12.875 11.9275 14.28 13.3025 15.57C13.9475 16.215 14.7075 16.86 15.4675 16.86C15.8675 16.86 16.2675 16.675 16.5825 16.445C16.8975 16.675 17.2975 16.86 17.6975 16.86C18.4575 16.86 19.2175 16.215 19.8625 15.57C21.2375 14.28 21.9275 12.875 21.9275 11.585C21.9275 10.065 20.7225 8.86 19.2025 8.86C18.5575 8.86 18.0125 9.09 17.6975 9.32C17.3825 9.09 16.6875 8.86 17.0425 8.86ZM15.4675 10.755C15.6975 10.755 15.9275 10.87 16.1575 11.1C16.3875 11.33 16.5025 11.56 16.5025 11.79C16.5025 12.02 16.3875 12.25 16.1575 12.48C15.9275 12.71 15.6975 12.825 15.4675 12.825C15.2375 12.825 15.0075 12.71 14.7775 12.48C14.5475 12.25 14.4325 12.02 14.4325 11.79C14.4325 11.56 14.5475 11.33 14.7775 11.1C15.0075 10.87 15.2375 10.755 15.4675 10.755Z"/>
    <path d="M7.5 8C6.12 8 5 9.12 5 10.5V17.5C5 18.88 6.12 20 7.5 20H16.5C17.88 20 19 18.88 19 17.5V14C18.5 14.5 17.9 14.9 17.2 15.2C17.1 15.9 16.5 16.5 15.5 16.5C14.5 16.5 13.9 15.9 13.8 15.2C13.1 14.9 12.5 14.5 12 14V17.5C12 17.78 11.78 18 11.5 18H8.5C8.22 18 8 17.78 8 17.5V10.5C8 10.22 8.22 10 8.5 10H11.5C11.78 10 12 10.22 12 10.5V12C12.5 11.5 13.1 11.1 13.8 10.8C13.9 10.1 14.5 9.5 15.5 9.5C16.5 9.5 17.1 10.1 17.2 10.8C17.9 11.1 18.5 11.5 19 12V10.5C19 9.12 17.88 8 16.5 8H7.5Z"/>
  </svg>
)

const GooglePayIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path fill="#4285F4" d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z"/>
  </svg>
)

export type PaymentMethodType = "card" | "apple_pay" | "google_pay" | "bank"

interface PaymentMethod {
  id: PaymentMethodType
  name: string
  description: string
  icon: React.ReactNode
  available: boolean
}

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethodType
  onSelectMethod: (method: PaymentMethodType) => void
}

const paymentMethods: PaymentMethod[] = [
  {
    id: "card",
    name: "Credit / Debit Card",
    description: "Visa, Mastercard, Amex, Discover",
    icon: <CreditCard className="w-6 h-6" />,
    available: true,
  },
  {
    id: "apple_pay",
    name: "Apple Pay",
    description: "Pay with Touch ID or Face ID",
    icon: <ApplePayIcon />,
    available: true,
  },
  {
    id: "google_pay",
    name: "Google Pay",
    description: "Fast checkout with Google",
    icon: <GooglePayIcon />,
    available: true,
  },
  {
    id: "bank",
    name: "Bank Transfer",
    description: "ACH or wire transfer",
    icon: <Building2 className="w-6 h-6" />,
    available: true,
  },
]

export function PaymentMethodSelector({ selectedMethod, onSelectMethod }: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-3">
      {paymentMethods.map((method) => (
        <motion.button
          key={method.id}
          type="button"
          onClick={() => method.available && onSelectMethod(method.id)}
          disabled={!method.available}
          className={cn(
            "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
            selectedMethod === method.id
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 bg-card",
            !method.available && "opacity-50 cursor-not-allowed"
          )}
          whileHover={method.available ? { scale: 1.01 } : {}}
          whileTap={method.available ? { scale: 0.99 } : {}}
        >
          <div className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center",
            selectedMethod === method.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {method.icon}
          </div>
          
          <div className="flex-1">
            <p className={cn(
              "font-medium",
              selectedMethod === method.id ? "text-foreground" : "text-foreground"
            )}>
              {method.name}
            </p>
            <p className="text-sm text-muted-foreground">
              {method.description}
            </p>
          </div>

          <div className={cn(
            "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
            selectedMethod === method.id
              ? "border-primary bg-primary"
              : "border-muted-foreground/30"
          )}>
            {selectedMethod === method.id && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.3 }}
              >
                <Check className="w-4 h-4 text-primary-foreground" />
              </motion.div>
            )}
          </div>
        </motion.button>
      ))}
    </div>
  )
}
