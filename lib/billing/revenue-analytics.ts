import "server-only"
import { createServiceClient } from "@/lib/supabase/service"
import { getPlanById } from "@/lib/products"

interface RevenueMetrics {
  mrr: number
  arr: number
  previousMrr: number
  mrrChange: number
  arrChange: number
  activeSubscriptions: number
  churnRate: number
  previousChurnRate: number
  churnChange: number
  averageRevenuePerUser: number
  lifetimeValue: number
  revenueByPlan: { planName: string; amount: number; subscribers: number }[]
  revenueByRegion: { region: string; amount: number; percentage: number }[]
  monthlyTrend: { month: string; mrr: number; churn: number; newBusiness: number }[]
}

interface ChurnAnalysis {
  totalChurned: number
  voluntaryChurn: number
  involuntaryChurn: number
  churnByReason: { reason: string; count: number }[]
  churnByPlan: { planName: string; count: number }[]
  atRiskAccounts: { name: string; email: string; plan: string; risk: "low" | "medium" | "high" }[]
}

interface RevenueForecast {
  currentMrr: number
  forecastNextMonth: number
  forecastNextQuarter: number
  forecastNextYear: number
  confidence: "low" | "medium" | "high"
  growthRate: number
}

interface SubscriptionRow {
  id: string
  organization_id: string
  plan_id: string
  status: string
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
  stripe_subscription_id?: string | null
  razorpay_subscription_id?: string | null
}

// Approximate, fixed USD/INR rate used ONLY to combine a Razorpay (INR)
// subscriber's native price into the single USD-denominated MRR/ARR figure
// this dashboard displays. This is intentionally not a live FX lookup --
// precision to the rupee doesn't matter for a rollup metric, and a fixed
// rate keeps historical MRR numbers stable instead of drifting every time
// this function is called. Revisit this constant periodically.
const INR_TO_USD_RATE = 1 / 83

// Returns the subscriber's monthly price in USD, using the plan's native
// price for whichever gateway the subscription actually runs on: Stripe
// subscribers are billed in USD (priceInCents), Razorpay subscribers are
// billed in INR (priceInr, in paise). Previously this always read
// priceInCents regardless of gateway, so Razorpay/INR subscribers' MRR was
// computed from their USD list price instead of what they're actually
// billed -- summing raw USD-cents and raw INR-paise together would also
// have been wrong, so Razorpay figures are converted at the fixed rate
// above rather than left in a different currency.
function monthlyPriceOf(sub: Pick<SubscriptionRow, "plan_id" | "stripe_subscription_id" | "razorpay_subscription_id">): number {
  const plan = getPlanById(sub.plan_id)
  if (!plan) return 0
  if (!sub.stripe_subscription_id && sub.razorpay_subscription_id) {
    return (plan.priceInr / 100) * INR_TO_USD_RATE
  }
  return plan.priceInCents / 100
}

const ACTIVE_STATUSES = ["active"]
const CHURNED_STATUSES = ["cancelled", "expired"]

async function fetchSubscriptions(db: ReturnType<typeof createServiceClient>): Promise<SubscriptionRow[]> {
  const { data } = await db
    .from("subscriptions")
    .select("id, organization_id, plan_id, status, cancel_at_period_end, created_at, updated_at, stripe_subscription_id, razorpay_subscription_id")
  return data ?? []
}

function regionFor(country: string | null): string {
  if (!country) return "Unknown"
  const c = country.toUpperCase()
  if (c === "IN" || c === "INDIA") return "India"
  if (["US", "CA", "USA", "CANADA"].includes(c)) return "North America"
  if (["GB", "UK", "DE", "FR", "ES", "IT", "NL"].includes(c)) return "Europe"
  return "Other"
}

export async function getRevenueMetrics(): Promise<RevenueMetrics> {
  const db = createServiceClient()
  const subs = await fetchSubscriptions(db)

  const active = subs.filter((s) => ACTIVE_STATUSES.includes(s.status))
  const mrr = active.reduce((sum, s) => sum + monthlyPriceOf(s), 0)
  const arr = mrr * 12

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
  const previouslyActive = subs.filter(
    (s) => new Date(s.created_at) <= thirtyDaysAgo && (ACTIVE_STATUSES.includes(s.status) || (CHURNED_STATUSES.includes(s.status) && new Date(s.updated_at) > thirtyDaysAgo)),
  )
  const previousMrr = previouslyActive.reduce((sum, s) => sum + monthlyPriceOf(s), 0)
  const mrrChange = previousMrr > 0 ? Number((((mrr - previousMrr) / previousMrr) * 100).toFixed(1)) : 0
  const arrChange = mrrChange

  const churnedLast30Days = subs.filter((s) => CHURNED_STATUSES.includes(s.status) && new Date(s.updated_at) >= thirtyDaysAgo)
  const denominatorNow = active.length + churnedLast30Days.length
  const churnRate = denominatorNow > 0 ? Number(((churnedLast30Days.length / denominatorNow) * 100).toFixed(1)) : 0

  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000)
  const churnedPrior30Days = subs.filter(
    (s) => CHURNED_STATUSES.includes(s.status) && new Date(s.updated_at) >= sixtyDaysAgo && new Date(s.updated_at) < thirtyDaysAgo,
  )
  const denominatorPrior = previouslyActive.length + churnedPrior30Days.length
  const previousChurnRate = denominatorPrior > 0 ? Number(((churnedPrior30Days.length / denominatorPrior) * 100).toFixed(1)) : 0
  const churnChange = previousChurnRate > 0 ? Number((((previousChurnRate - churnRate) / previousChurnRate) * 100).toFixed(1)) : 0

  const activeSubscriptions = active.length
  const averageRevenuePerUser = activeSubscriptions > 0 ? Math.round(mrr / activeSubscriptions) : 0
  const lifetimeValue = churnRate > 0 ? Math.round(averageRevenuePerUser * (100 / churnRate)) : 0

  const byPlan = new Map<string, { amount: number; subscribers: number }>()
  for (const s of active) {
    const entry = byPlan.get(s.plan_id) ?? { amount: 0, subscribers: 0 }
    entry.amount += monthlyPriceOf(s)
    entry.subscribers += 1
    byPlan.set(s.plan_id, entry)
  }
  const revenueByPlan = Array.from(byPlan.entries()).map(([planId, v]) => ({
    planName: getPlanById(planId)?.name ?? planId,
    amount: Math.round(v.amount),
    subscribers: v.subscribers,
  }))

  const orgIds = [...new Set(active.map((s) => s.organization_id))]
  const { data: orgs } = orgIds.length > 0
    ? await db.from("organizations").select("id, country").in("id", orgIds)
    : { data: [] as { id: string; country: string | null }[] }
  const countryByOrg = new Map((orgs ?? []).map((o) => [o.id, o.country]))

  const byRegion = new Map<string, number>()
  for (const s of active) {
    const region = regionFor(countryByOrg.get(s.organization_id) ?? null)
    byRegion.set(region, (byRegion.get(region) ?? 0) + monthlyPriceOf(s))
  }
  const revenueByRegion = Array.from(byRegion.entries()).map(([region, amount]) => ({
    region,
    amount: Math.round(amount),
    percentage: mrr > 0 ? Math.round((amount / mrr) * 100) : 0,
  }))

  const monthlyTrend: { month: string; mrr: number; churn: number; newBusiness: number }[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const activeAtMonthEnd = subs.filter(
      (s) => new Date(s.created_at) <= monthEnd && (ACTIVE_STATUSES.includes(s.status) || new Date(s.updated_at) > monthEnd),
    )
    const monthMrr = activeAtMonthEnd.reduce((sum, s) => sum + monthlyPriceOf(s), 0)
    const churnedInMonth = subs.filter((s) => CHURNED_STATUSES.includes(s.status) && new Date(s.updated_at) >= monthStart && new Date(s.updated_at) <= monthEnd)
    const newInMonth = subs.filter((s) => new Date(s.created_at) >= monthStart && new Date(s.created_at) <= monthEnd)
    monthlyTrend.push({
      month: monthStart.toLocaleString("default", { month: "short", year: "2-digit" }),
      mrr: Math.round(monthMrr),
      churn: activeAtMonthEnd.length > 0 ? Number(((churnedInMonth.length / activeAtMonthEnd.length) * 100).toFixed(1)) : 0,
      newBusiness: newInMonth.length,
    })
  }

  return {
    mrr: Math.round(mrr),
    arr: Math.round(arr),
    previousMrr: Math.round(previousMrr),
    mrrChange,
    arrChange,
    activeSubscriptions,
    churnRate,
    previousChurnRate,
    churnChange,
    averageRevenuePerUser,
    lifetimeValue,
    revenueByPlan,
    revenueByRegion,
    monthlyTrend,
  }
}

export async function getChurnAnalysis(): Promise<ChurnAnalysis> {
  const db = createServiceClient()
  const subs = await fetchSubscriptions(db)

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000)
  const churned = subs.filter((s) => CHURNED_STATUSES.includes(s.status) && new Date(s.updated_at) >= ninetyDaysAgo)

  const churnedIds = churned.map((s) => s.id)
  const { data: failedPayments } = churnedIds.length > 0
    ? await db.from("billing_events").select("subscription_id").eq("status", "failed").in("subscription_id", churnedIds)
    : { data: [] as { subscription_id: string }[] }
  const involuntaryIds = new Set((failedPayments ?? []).map((e) => e.subscription_id))

  const voluntaryChurn = churned.filter((s) => !involuntaryIds.has(s.id)).length
  const involuntaryChurn = churned.filter((s) => involuntaryIds.has(s.id)).length

  const byPlan = new Map<string, number>()
  for (const s of churned) byPlan.set(s.plan_id, (byPlan.get(s.plan_id) ?? 0) + 1)
  const churnByPlan = Array.from(byPlan.entries()).map(([planId, count]) => ({
    planName: getPlanById(planId)?.name ?? planId,
    count,
  }))

  // "At risk" = active subscriptions already scheduled to cancel, or trialing
  // subscriptions whose trial has nearly run out with no upgrade yet.
  const atRisk = subs.filter((s) => s.status === "active" && s.cancel_at_period_end)
  const orgIds = [...new Set(atRisk.map((s) => s.organization_id))]
  const { data: orgs } = orgIds.length > 0
    ? await db.from("organizations").select("id, name").in("id", orgIds)
    : { data: [] as { id: string; name: string }[] }
  const { data: profiles } = orgIds.length > 0
    ? await db.from("profiles").select("organization_id, email").in("organization_id", orgIds)
    : { data: [] as { organization_id: string; email: string }[] }
  const nameByOrg = new Map((orgs ?? []).map((o) => [o.id, o.name]))
  const emailByOrg = new Map((profiles ?? []).map((p) => [p.organization_id, p.email]))

  const atRiskAccounts = atRisk.map((s) => ({
    name: nameByOrg.get(s.organization_id) ?? "Unknown organization",
    email: emailByOrg.get(s.organization_id) ?? "",
    plan: getPlanById(s.plan_id)?.name ?? s.plan_id,
    risk: "high" as const,
  }))

  return {
    totalChurned: churned.length,
    voluntaryChurn,
    involuntaryChurn,
    // No reason-tracking exists anywhere in this schema (no cancellation-reason
    // field) -- reporting an honest empty list instead of inventing reasons.
    churnByReason: [],
    churnByPlan,
    atRiskAccounts,
  }
}

export async function getRevenueForecast(metrics?: RevenueMetrics): Promise<RevenueForecast> {
  metrics ??= await getRevenueMetrics()
  const growthRate = metrics.mrrChange
  const confidence: RevenueForecast["confidence"] = metrics.activeSubscriptions >= 20 ? "high" : metrics.activeSubscriptions >= 5 ? "medium" : "low"

  return {
    currentMrr: metrics.mrr,
    forecastNextMonth: Math.round(metrics.mrr * (1 + growthRate / 100 / 12)),
    forecastNextQuarter: Math.round(metrics.mrr * (1 + growthRate / 100 / 4)),
    forecastNextYear: Math.round(metrics.mrr * (1 + growthRate / 100)),
    confidence,
    growthRate,
  }
}

export async function getMonthlyMrrHistory(): Promise<{ month: string; mrr: number }[]> {
  const metrics = await getRevenueMetrics()
  return metrics.monthlyTrend.map(({ month, mrr }) => ({ month, mrr }))
}
