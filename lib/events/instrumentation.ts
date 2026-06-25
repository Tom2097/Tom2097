export type EventType = "page_view" | "signup" | "login" | "deal_created" | "deal_won" | "deal_lost" | "email_opened" | "email_clicked" | "demo_requested" | "trial_started" | "trial_converted" | "support_ticket" | "invoice_paid" | "invoice_overdue"

export interface TrackedEvent {
  id: string; event: EventType; userId: string; organizationId: string
  sessionId: string; timestamp: Date; properties: Record<string, unknown>
}

export interface FunnelStep {
  step: number; name: string; event: EventType; count: number; conversion: number
}

export function createFunnel(eventNames: EventType[]): FunnelStep[] {
  return eventNames.map((name, i) => ({
    step: i + 1,
    name: name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    event: name,
    count: Math.round(Math.random() * 1000 + 500),
    conversion: 100,
  })).map((step, i, arr) => {
    if (i === 0) return { ...step, conversion: 100 }
    const prevCount = arr[i - 1].count
    return { ...step, conversion: prevCount > 0 ? Math.round((step.count / prevCount) * 100) : 0 }
  })
}

export function calculateRetention(
  events: TrackedEvent[], cohortField: "week" | "month" = "week"
): Array<{ cohort: string; periods: Array<{ period: string; retained: number; total: number; rate: number }> }> {
  const cohorts = new Map<string, TrackedEvent[]>()
  events.forEach((e) => {
    const key = cohortField === "week"
      ? getISOWeek(e.timestamp)
      : `${e.timestamp.getFullYear()}-${String(e.timestamp.getMonth() + 1).padStart(2, "0")}`
    if (!cohorts.has(key)) cohorts.set(key, [])
    cohorts.get(key)!.push(e)
  })
  return Array.from(cohorts.entries()).slice(0, 6).map(([cohort, evts]) => {
    const firstUsers = new Set(evts.map((e) => e.userId))
    const periods = Array.from({ length: 5 }, (_, i) => {
      const periodEvents = evts.filter((e) => {
        const diff = e.timestamp.getTime() - evts[0].timestamp.getTime()
        const periodMs = (i + 1) * (cohortField === "week" ? 7 : 30) * 24 * 60 * 60 * 1000
        return diff <= periodMs && diff > i * (cohortField === "week" ? 7 : 30) * 24 * 60 * 60 * 1000
      })
      const retained = new Set(periodEvents.map((e) => e.userId))
      return {
        period: `P${i + 1}`,
        retained: retained.size,
        total: firstUsers.size,
        rate: firstUsers.size > 0 ? Math.round((retained.size / firstUsers.size) * 100) : 0,
      }
    })
    return { cohort, periods }
  })
}

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`
}

export function trackEvent(
  event: EventType, userId: string, organizationId: string,
  sessionId: string, properties?: Record<string, unknown>
): TrackedEvent {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    event, userId, organizationId, sessionId,
    timestamp: new Date(),
    properties: properties || {},
  }
}
