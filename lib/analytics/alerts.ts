import { createServiceClient } from "@/lib/supabase/service"
import { publish } from "@/lib/events/bus"

export interface AlertRule {
  id: string; organization_id: string; metric: string
  condition: "gt" | "lt" | "gte" | "lte" | "anomaly"
  threshold: number; severity: "info" | "warning" | "critical"
  channel: "notification" | "email" | "webhook" | "all"
  enabled: boolean
}

export interface AlertEvent {
  id: string; organization_id: string; rule_id: string; metric: string
  actual_value: number; threshold: number; severity: string
  acknowledged: boolean; created_at: string
}

export async function evaluateAlertRules(organizationId: string, metric: string, currentValue: number): Promise<AlertEvent[]> {
  const db = createServiceClient()
  const { data: rules } = await db.from("alert_rules").select("*").eq("organization_id", organizationId).eq("metric", metric).eq("enabled", true)
  const events: AlertEvent[] = []

  for (const rule of (rules ?? []) as AlertRule[]) {
    let triggered = false
    if (rule.condition === "gt") triggered = currentValue > rule.threshold
    else if (rule.condition === "lt") triggered = currentValue < rule.threshold
    else if (rule.condition === "gte") triggered = currentValue >= rule.threshold
    else if (rule.condition === "lte") triggered = currentValue <= rule.threshold

    if (triggered) {
      const { data: event } = await db.from("alert_events").insert({
        organization_id: organizationId, rule_id: rule.id, metric,
        actual_value: currentValue, threshold: rule.threshold, severity: rule.severity,
      }).select("*").single()
      if (event) {
        events.push(event as AlertEvent)
        await publish({
          type: "performance.threshold_breached", organization_id: organizationId,
          data: { metric, value: currentValue, threshold: rule.threshold },
        })
      }
    }
  }

  return events
}
