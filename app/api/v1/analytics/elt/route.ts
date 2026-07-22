import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { createPipeline, runPipeline, listPipelines, getPipelineLogs, type EltPipeline } from "@/lib/analytics/elt-extended"
import { logger } from "@/lib/logging"

/**
 * GET /api/v1/analytics/elt
 *
 * List ELT pipelines for the organization. Pass ?pipelineId= to also include
 * that pipeline's recent run logs.
 */
export const GET = withAuth(
  async (request: NextRequest, context) => {
    const { searchParams } = new URL(request.url)
    const pipelineId = searchParams.get("pipelineId")

    try {
      const pipelines = await listPipelines(context.organizationId)
      if (pipelineId) {
        const logs = await getPipelineLogs(pipelineId, 20)
        return NextResponse.json({ success: true, data: { pipelines, logs } })
      }
      return NextResponse.json({ success: true, data: { pipelines } })
    } catch (error) {
      logger.logError("[API] Error listing ELT pipelines:", error instanceof Error ? { message: error.message } : { error: String(error) })
      return NextResponse.json({ success: false, error: "Failed to list pipelines" }, { status: 500 })
    }
  },
  { requireAll: ["analytics:read"] },
)

/**
 * POST /api/v1/analytics/elt
 *
 * Create a new pipeline, or trigger a run of an existing one.
 * Body: { action: "run", pipelineId } | { action?: "create", name, source_table,
 *         target_table, column_map, batch_size, schedule?, enabled }
 */
export const POST = withAuth(
  async (request: NextRequest, context) => {
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
    }

    try {
      if (body.action === "run") {
        if (typeof body.pipelineId !== "string") {
          return NextResponse.json({ success: false, error: "pipelineId is required" }, { status: 400 })
        }
        const runLog = await runPipeline(body.pipelineId, context.organizationId)
        if (!runLog) {
          return NextResponse.json({ success: false, error: "Pipeline not found" }, { status: 404 })
        }
        return NextResponse.json({ success: true, data: runLog })
      }

      const { name, source_table, target_table, column_map, batch_size, schedule, enabled } = body
      if (!name || !source_table || !target_table || typeof column_map !== "object" || !column_map) {
        return NextResponse.json(
          { success: false, error: "name, source_table, target_table, and column_map are required" },
          { status: 400 },
        )
      }

      const pipeline: Omit<EltPipeline, "id" | "organization_id" | "last_run_at" | "status"> = {
        name,
        source_table,
        target_table,
        column_map,
        batch_size: Number(batch_size) || 100,
        schedule: schedule ?? null,
        enabled: enabled !== false,
      }

      const pipelineId = await createPipeline(context.organizationId, pipeline)
      if (!pipelineId) {
        return NextResponse.json({ success: false, error: "Failed to create pipeline" }, { status: 500 })
      }
      return NextResponse.json({ success: true, data: { id: pipelineId } }, { status: 201 })
    } catch (error) {
      logger.logError("[API] Error in ELT pipeline operation:", error instanceof Error ? { message: error.message } : { error: String(error) })
      return NextResponse.json({ success: false, error: "ELT operation failed" }, { status: 500 })
    }
  },
  { requireAll: ["analytics:write"] },
)
