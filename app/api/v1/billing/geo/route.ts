import { NextResponse } from "next/server"
import { getGeoPricingInfo, shouldShowInrPricing, getPaymentProvider } from "@/lib/billing/geo-gating"

export async function GET() {
  try {
    const [geoInfo, showInr, paymentProvider] = await Promise.all([
      getGeoPricingInfo(),
      shouldShowInrPricing(),
      getPaymentProvider(),
    ])

    return NextResponse.json({
      ...geoInfo,
      showInrPricing: showInr,
      paymentProvider,
    })
  } catch (error) {
    console.error("[geo] Failed to detect location:", error)
    return NextResponse.json({
      country: "US",
      currency: "USD",
      provider: "stripe",
      gstRate: 0,
      isIndia: false,
      showInrPricing: false,
      paymentProvider: "stripe",
    })
  }
}
