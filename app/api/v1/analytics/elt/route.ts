import { NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { createPipeline, runPipeline, listPipelines, getPipelineLogs } from "@/lib/analytics/elt-extended"

export async function POST(request: Request) {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 403 })

    const { action, ...params } = await request.json()

    switch (action) {
      case "create": {
        const id = await createPipeline(orgId, params)
        return NextResponse.json({ success: true, data: { id } })
      }
      case "run": {
        if (!params.pipelineId) return NextResponse.json({ error: "pipelineId is required" }, { status: 400 })
        const log = await runPipeline(params.pipelineId, orgId)
        return NextResponse.json({ success: true, data: log })
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "ELT operation failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 403 })

    const url = new URL(request.url)
    const pipelineId = url.searchParams.get("pipeline_id")

    if (pipelineId) {
      const logs = await getPipelineLogs(pipelineId)
      return NextResponse.json({ success: true, data: { pipeline_id: pipelineId, logs } })
    }

    const pipelines = await listPipelines(orgId)
    return NextResponse.json({ success: true, data: pipelines })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch pipelines"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
