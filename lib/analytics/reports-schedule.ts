import { createServiceClient } from "@/lib/supabase/service"
import { runQuery } from "./engine"
import type { AnalyticsQuery } from "./types"

export interface ScheduledReport {
  id: string; organization_id: string; name: string
  query: AnalyticsQuery; schedule_cron: string
  channel: "email" | "slack" | "webhook"
  recipients: string[]; last_sent_at: string | null; enabled: boolean
}

export async function listScheduledReports(organizationId: string): Promise<ScheduledReport[]> {
  const db = createServiceClient()
  const { data } = await db.from("scheduled_reports").select("*").eq("organization_id", organizationId)
  return (data ?? []) as ScheduledReport[]
}

export async function generateAndSendReport(reportId: string): Promise<boolean> {
  const db = createServiceClient()
  const { data: report } = await db.from("scheduled_reports").select("*").eq("id", reportId).single()
  if (!report) return false
  const r = report as ScheduledReport
  try {
    const result = await runQuery(r.organization_id, r.query)
    const summary = JSON.stringify(result).slice(0, 5000)
    await db.from("scheduled_reports").update({ last_sent_at: new Date().toISOString() }).eq("id", reportId)
    if (r.channel === "email" && r.recipients.length > 0) {
      const apiKey = process.env.RESEND_API_KEY
      if (apiKey) {
        await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "reports@digit.app", to: r.recipients, subject: `Report: ${r.name}`, html: `<pre>${summary}</pre>` }),
        })
      }
    }
    return true
  } catch { return false }
}
