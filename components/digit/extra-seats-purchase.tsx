"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Users, Plus, Minus, ShoppingCart, Loader2, Check, AlertCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const PRICE_PER_SEAT = 29

export function ExtraSeatsPurchase() {
  const [quantity, setQuantity] = useState(1)
  const [purchasing, setPurchasing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePurchase = async () => {
    setPurchasing(true)
    setError(null)
    try {
      const res = await fetch("/api/v1/billing/extra-seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Purchase failed")
      }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPurchasing(false)
    }
  }

  return (
    <Card className="p-6 border-border/50 bg-card/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Additional Seats</h3>
          <p className="text-xs text-muted-foreground">Add more team members to your plan</p>
        </div>
      </div>

      <div className="flex items-center gap-6 mb-6">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="outline" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>
            <Minus className="w-4 h-4" />
          </Button>
          <span className="text-2xl font-bold text-foreground w-12 text-center">{quantity}</span>
          <Button size="icon" variant="outline" onClick={() => setQuantity(Math.min(100, quantity + 1))} disabled={quantity >= 100}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-foreground">${(quantity * PRICE_PER_SEAT).toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">${PRICE_PER_SEAT}/seat/month</p>
        </div>
      </div>

      <Button className="w-full" onClick={handlePurchase} disabled={purchasing || success}>
        {purchasing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : success ? <Check className="w-4 h-4 mr-2" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
        {purchasing ? "Processing..." : success ? "Added!" : `Purchase ${quantity} seat${quantity > 1 ? "s" : ""}`}
      </Button>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" />
          {error}
        </motion.div>
      )}
    </Card>
  )
}
