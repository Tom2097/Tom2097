import "server-only"
import { createServiceClient } from "@/lib/supabase/service"

export interface ReportData {
  columns: string[]
  rows: Array<Record<string, unknown>>
  summary: { total: number; average: number; count: number; insights: string[] }
}

/** Computes real report data from the org's actual documents/workflows/events -- no RPC, no fabricated numbers. */
export async function computeReportData(organizationId: string, dataSource: string): Promise<ReportData> {
  const db = createServiceClient()

  if (dataSource === "workflows") {
    const { data } = await db
      .from("workflow_executions")
      .select("workflow_id, status, trigger_type, started_at, completed_at")
      .eq("organization_id", organizationId)
      .order("started_at", { ascending: false })
      .limit(100)
    const rows = data ?? []
    const completed = rows.filter((r) => r.status === "completed").length
    return {
      columns: ["Workflow", "Status", "Trigger", "Started", "Completed"],
      rows: rows.map((r) => ({ Workflow: r.workflow_id, Status: r.status, Trigger: r.trigger_type, Started: r.started_at, Completed: r.completed_at ?? "—" })),
      summary: {
        total: rows.length,
        average: rows.length > 0 ? Math.round((completed / rows.length) * 100) : 0,
        count: rows.length,
        insights: rows.length > 0 ? [`${completed} of ${rows.length} executions completed successfully`] : ["No workflow executions yet"],
      },
    }
  }

  if (dataSource === "events") {
    const { data } = await db
      .from("crm_events")
      .select("event_name, occurred_at")
      .eq("organization_id", organizationId)
      .order("occurred_at", { ascending: false })
      .limit(200)
    const rows = data ?? []
    const byName = new Map<string, number>()
    for (const r of rows) byName.set(r.event_name, (byName.get(r.event_name) ?? 0) + 1)
    return {
      columns: ["Event", "Occurred At"],
      rows: rows.slice(0, 100).map((r) => ({ Event: r.event_name, "Occurred At": r.occurred_at })),
      summary: {
        total: rows.length,
        average: 0,
        count: rows.length,
        insights: rows.length > 0 ? Array.from(byName.entries()).map(([name, count]) => `${count}x ${name}`) : ["No events recorded yet"],
      },
    }
  }

  if (dataSource === "all") {
    const [{ count: docCount }, { count: wfCount }, { count: evCount }] = await Promise.all([
      db.from("documents").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      db.from("workflow_executions").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      db.from("crm_events").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    ])
    const total = (docCount ?? 0) + (wfCount ?? 0) + (evCount ?? 0)
    return {
      columns: ["Source", "Count"],
      rows: [
        { Source: "Documents", Count: docCount ?? 0 },
        { Source: "Workflow Executions", Count: wfCount ?? 0 },
        { Source: "CRM Events", Count: evCount ?? 0 },
      ],
      summary: { total, average: 0, count: 3, insights: [] },
    }
  }

  // Default / "documents"
  const { data } = await db
    .from("documents")
    .select("name, type, status, classification, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100)
  const rows = data ?? []
  const byStatus = new Map<string, number>()
  for (const r of rows) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1)
  return {
    columns: ["Name", "Type", "Status", "Classification", "Created"],
    rows: rows.map((r) => ({ Name: r.name, Type: r.type, Status: r.status, Classification: r.classification ?? "—", Created: r.created_at })),
    summary: {
      total: rows.length,
      average: 0,
      count: rows.length,
      insights: rows.length > 0 ? Array.from(byStatus.entries()).map(([status, count]) => `${count} document(s) with status "${status}"`) : ["No documents yet"],
    },
  }
}
