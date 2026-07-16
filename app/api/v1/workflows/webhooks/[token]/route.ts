import { type NextRequest, NextResponse } from "next/server"
import { getWorkflowByWebhookToken } from "@/lib/workflows/store"
import { triggerWorkflow } from "@/lib/workflows/trigger"

/**
 * POST /api/v1/workflows/webhooks/[token] — external trigger for
 * webhook-type workflows. The unguessable token is the auth credential
 * (no session/org auth here — this endpoint is meant to be called by
 * outside systems).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const workflow = await getWorkflowByWebhookToken(token)
  if (!workflow || !workflow.enabled) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let input: Record<string, unknown> = {}
  try {
    const body = await req.json()
    if (body && typeof body === "object") input = body
  } catch {
    // empty body is fine for webhook pings
  }

  const run = await triggerWorkflow(workflow, "webhook", input, null)
  if (!run) return NextResponse.json({ error: "Failed to start execution" }, { status: 500 })

  return NextResponse.json(run, { status: 202 })
}
