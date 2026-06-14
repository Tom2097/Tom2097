import { type NextRequest, NextResponse } from "next/server"
import { getWorkflowByWebhookToken } from "@/lib/workflows/store"
import { triggerWorkflow } from "@/lib/workflows/engine"

/**
 * Public webhook trigger: POST /api/v1/workflows/webhooks/{token}
 *
 * No withAuth — the unguessable token IS the credential and resolves both the
 * workflow and its owning organization, so tenant scoping is preserved. The
 * POST body becomes the workflow input.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.pathname.split("/")[5] ?? ""
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 })

  const workflow = await getWorkflowByWebhookToken(token)
  if (!workflow) return NextResponse.json({ error: "Invalid webhook token" }, { status: 404 })
  if (workflow.trigger.type !== "webhook") {
    return NextResponse.json({ error: "Workflow is not webhook-triggered" }, { status: 409 })
  }
  if (!workflow.enabled) {
    return NextResponse.json({ error: "Workflow is disabled" }, { status: 409 })
  }

  let input: Record<string, unknown> = {}
  try {
    const body = await req.json()
    if (body && typeof body === "object") input = body
  } catch {
    // empty/invalid body → empty input
  }

  const result = await triggerWorkflow(workflow, "webhook", input, null)
  if (!result) {
    return NextResponse.json({ error: "Failed to start execution" }, { status: 500 })
  }

  return NextResponse.json(
    { executionId: result.executionId, runId: result.runId, status: "started" },
    { status: 202 },
  )
}
