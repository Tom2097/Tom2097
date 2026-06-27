import { createServiceClient } from "@/lib/supabase/service"
import { publish } from "@/lib/events/bus"

export interface EltPipeline {
  id?: string
  name: string
  source_table: string
  target_table: string
  column_map: Record<string, string>
  batch_size: number
  schedule: string | null
  enabled: boolean
  organization_id: string
  last_run_at: string | null
  status: "idle" | "running" | "failed"
}

export interface EltRunLog {
  id?: string
  pipeline_id: string
  started_at: string
  completed_at: string | null
  rows_processed: number
  rows_inserted: number
  rows_updated: number
  rows_failed: number
  status: "running" | "completed" | "failed"
  error_message: string | null
}

export async function createPipeline(
  organizationId: string,
  pipeline: Omit<EltPipeline, "id" | "organization_id" | "last_run_at" | "status">,
): Promise<string | null> {
  const db = createServiceClient()
  const { data } = await db.from("elt_pipelines").insert({
    ...pipeline,
    organization_id: organizationId,
    status: "idle",
  }).select("id").single()
  return data?.id ?? null
}

export async function runPipeline(
  pipelineId: string,
  organizationId: string,
): Promise<EltRunLog | null> {
  const db = createServiceClient()

  const { data: pipeline } = await db.from("elt_pipelines")
    .select("*")
    .eq("id", pipelineId)
    .eq("organization_id", organizationId)
    .single()

  if (!pipeline) return null

  const startTime = new Date().toISOString()
  const runLog: EltRunLog = {
    pipeline_id: pipelineId,
    started_at: startTime,
    completed_at: null,
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_failed: 0,
    status: "running",
    error_message: null,
  }

  await db.from("elt_pipelines").update({ status: "running", last_run_at: startTime }).eq("id", pipelineId)
  const { data: logEntry } = await db.from("elt_run_logs").insert(runLog).select("id").single()
  const logId = logEntry?.id

  try {
    const columnMap = pipeline.column_map
    const batchSize = pipeline.batch_size ?? 100
    const sourceTable = pipeline.source_table
    const targetTable = pipeline.target_table

    const sourceColumns = Object.keys(columnMap)
    const targetColumns = Object.values(columnMap)
    const selectCols = sourceColumns.join(", ")

    const { data: sourceData, error: sourceError } = await db.rpc("execute_sql", {
      query_text: `SELECT ${selectCols} FROM ${sourceTable} WHERE organization_id = '${organizationId}' LIMIT ${batchSize}`,
    })

    if (sourceError) throw new Error(sourceError.message)

    const rows = sourceData as Record<string, unknown>[]
    runLog.rows_processed = rows.length

    let inserted = 0
    let updated = 0
    let failed = 0

    for (const row of rows) {
      const mappedRow: Record<string, unknown> = {}
      for (const [srcCol, tgtCol] of Object.entries(columnMap)) {
        mappedRow[tgtCol as string] = row[srcCol]
      }
      mappedRow.organization_id = organizationId

      const { error: insertError } = await db.from(targetTable).insert(mappedRow).maybeSingle()
      if (insertError) {
        const { error: updateError } = await db.from(targetTable)
          .update(mappedRow)
          .eq("organization_id", organizationId)
          .match({ id: row.id as string })
          .maybeSingle()
        if (updateError) failed++
        else updated++
      } else {
        inserted++
      }
    }

    runLog.rows_inserted = inserted
    runLog.rows_updated = updated
    runLog.rows_failed = failed
    runLog.status = "completed"
    runLog.completed_at = new Date().toISOString()

    await db.from("elt_pipelines").update({ status: "idle" }).eq("id", pipelineId)
    await db.from("elt_run_logs").update({
      completed_at: runLog.completed_at,
      rows_processed: runLog.rows_processed,
      rows_inserted: runLog.rows_inserted,
      rows_updated: runLog.rows_updated,
      rows_failed: runLog.rows_failed,
      status: runLog.status,
    }).eq("id", logId)

    await publish({
      type: "operational.record_populated",
      organization_id: organizationId,
      data: { entity_type: "elt_pipeline", entity_id: pipelineId, source_document: "" },
    })
 
    return runLog
  } catch (error) {
    runLog.status = "failed"
    runLog.error_message = (error as Error).message
    runLog.completed_at = new Date().toISOString()

    await db.from("elt_pipelines").update({ status: "failed" }).eq("id", pipelineId)
    await db.from("elt_run_logs").update({
      completed_at: runLog.completed_at,
      status: runLog.status,
      error_message: runLog.error_message,
    }).eq("id", logId)

    return runLog
  }
}

export async function listPipelines(
  organizationId: string,
): Promise<EltPipeline[]> {
  const db = createServiceClient()
  const { data } = await db.from("elt_pipelines")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
  return (data ?? []) as EltPipeline[]
}

export async function getPipelineLogs(
  pipelineId: string,
  limit: number = 20,
): Promise<EltRunLog[]> {
  const db = createServiceClient()
  const { data } = await db.from("elt_run_logs")
    .select("*")
    .eq("pipeline_id", pipelineId)
    .order("started_at", { ascending: false })
    .limit(limit)
  return (data ?? []) as EltRunLog[]
}
