"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, MapPin } from "lucide-react"

interface GeoInfo {
  country: string
  currency: string
  provider: string
  gstRate: number
  isIndia: boolean
  showInrPricing: boolean
  paymentProvider: string
}

export function GeoAwarePricing() {
  const [geoInfo, setGeoInfo] = useState<GeoInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/v1/billing/geo")
      .then((r) => r.json())
      .then((data) => setGeoInfo(data))
      .catch(() => setGeoInfo(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Detecting location...
      </div>
    )
  }

  if (!geoInfo) return null

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-sm">
            Pricing in <strong>{geoInfo.currency}</strong>
            {geoInfo.isIndia && (
              <Badge variant="outline" className="ml-2 text-xs">
                India
              </Badge>
            )}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {geoInfo.gstRate > 0 ? `+${geoInfo.gstRate}% GST` : "No GST"}
          {" · "}
          Via {geoInfo.provider === "razorpay" ? "Razorpay" : "Stripe"}
        </div>
      </CardContent>
    </Card>
  )
}
