import { headers } from "next/headers"

export interface GeoLocation {
  countryCode: string
  countryName: string
  region: string
  city: string
  isIndia: boolean
}

// Known Indian ISP/cloud ranges (simplified - in production use GeoIP database)
const INDIAN_IP_RANGES = [
  "103.", "106.", "110.", "111.", "112.", "113.", "114.", "115.", "116.",
  "117.", "118.", "119.", "120.", "121.", "122.", "123.", "124.", "125.",
  "126.", "157.", "158.", "159.", "163.", "164.", "165.", "166.", "167.",
  "168.", "169.", "170.", "171.", "172.", "173.", "174.", "175.", "180.",
  "182.", "183.", "202.", "203.", "210.", "211.", "218.", "219.", "220.",
  "221.", "222.", "223.", "49.", "59.", "61.", "14.", "27.",
]

function isIndianIP(ip: string): boolean {
  // Strip IPv6 prefix if present
  const cleanIP = ip.replace(/^::ffff:/, "")
  return INDIAN_IP_RANGES.some((range) => cleanIP.startsWith(range))
}

export async function detectGeoLocation(): Promise<GeoLocation> {
  const headersList = await headers()

  // No edge-provided geo-IP headers when self-hosted (Vercel's x-vercel-ip-*
  // headers only exist on Vercel's own edge network). Cloudflare's
  // cf-ipcountry still works if it's ever put in front; otherwise fall back
  // to the IP-range heuristic below.
  const cfCountry = headersList.get("cf-ipcountry")
  const xff = headersList.get("x-forwarded-for")
  const realIp = headersList.get("x-real-ip")
  const ip = xff?.split(",")[0]?.trim() || realIp || ""

  const isIndia = cfCountry === "IN" || (!cfCountry && isIndianIP(ip))
  const countryCode = cfCountry || (isIndia ? "IN" : "US")

  return {
    countryCode,
    countryName: getCountryName(countryCode),
    region: "",
    city: "",
    isIndia,
  }
}

export async function isIndianUser(): Promise<boolean> {
  const geo = await detectGeoLocation()
  return geo.isIndia
}

export async function getPricingCurrency(): Promise<"USD" | "INR"> {
  const isIndia = await isIndianUser()
  return isIndia ? "INR" : "USD"
}

export async function shouldShowInrPricing(): Promise<boolean> {
  const isIndia = await isIndianUser()
  const forceInr = process.env.FORCE_INR_PRICING === "true"
  return isIndia || forceInr
}

export async function getPaymentProvider(): Promise<"stripe" | "razorpay"> {
  const isIndia = await isIndianUser()
  if (isIndia && process.env.RAZORPAY_KEY_ID) return "razorpay"
  return "stripe"
}

function getCountryName(code: string): string {
  const names: Record<string, string> = {
    IN: "India",
    US: "United States",
    GB: "United Kingdom",
    SG: "Singapore",
    AE: "United Arab Emirates",
    AU: "Australia",
    CA: "Canada",
    DE: "Germany",
    FR: "France",
  }
  return names[code] || code
}

export async function getGeoPricingInfo() {
  const geo = await detectGeoLocation()
  const currency = geo.isIndia ? "INR" : "USD"
  const provider = geo.isIndia && process.env.RAZORPAY_KEY_ID ? "razorpay" : "stripe"
  const gstRate = geo.isIndia ? 18 : 0

  return {
    country: geo.countryCode,
    currency,
    provider,
    gstRate,
    isIndia: geo.isIndia,
    prices: geo.isIndia ? {
      starter: { monthly: 3499, annual: 34999 },
      professional: { monthly: 14999, annual: 149999 },
      enterprise: { monthly: 100000, annual: 1000000 },
    } : null,
  }
}
