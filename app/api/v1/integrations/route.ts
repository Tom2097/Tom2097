import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { createIntegration, listIntegrations, validateIntegration } from "@/lib/integrations/engine"
import type { IntegrationInput, IntegrationStatus, ListIntegrationsOptions } from "@/lib/integrations/types"

/**
 * GET /api/v1/integrations
 * List integrations for the caller's org. Requires integrations:read.
 * Query: ?limit=&offset=&status=active|paused|disabled&event=feedback.created
 */
const list = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const sp = req.nextUrl.searchParams
    const opts: ListIntegrationsOptions = {
      limit: Math.min(Math.max(Number(sp.get("limit") ?? 50), 1), 100),
      offset: Math.max(Number(sp.get("offset") ?? 0), 0),
      status: (sp.get("status") as IntegrationStatus | null) ?? undefined,
      event: sp.get("event") ?? undefined,
    }
    try {
      const result = await listIntegrations(organizationId, opts)
      return NextResponse.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list integrations"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["integrations:read"] },
)

/**
 * POST /api/v1/integrations
 * Create an integration. Returns the signing secret exactly once.
 * Requires integrations:write.
 */
const create = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const invalid = validateIntegration(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    try {
      const { integration, secret } = await createIntegration(
        organizationId,
        userId,
        body as unknown as IntegrationInput,
      )
      await logAuthEvent({
        action: "integration.created",
        userId,
        organizationId,
        resourceType: "integration",
        resourceId: integration.id,
        metadata: { provider: integration.provider, events: integration.events },
        ipAddress: getClientIp(req.headers),
      })
      // secret is returned ONLY here, never again
      return NextResponse.json({ integration, secret }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to create integration"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["integrations:write"] },
)

export { list as GET, create as POST }
