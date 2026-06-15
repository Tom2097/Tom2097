import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { createDsar, listDsar, validateDsar } from "@/lib/legal/engine"
import {
  DSAR_STATUSES,
  DSAR_TYPES,
  type DsarInput,
  type DsarStatus,
  type DsarType,
  type ListDsarOptions,
} from "@/lib/legal/types"

/** GET /api/v1/legal/dsar — list DSAR requests. Requires legal:read. */
const list = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const sp = req.nextUrl.searchParams
    const statusParam = sp.get("status")
    const typeParam = sp.get("requestType")
    const opts: ListDsarOptions = {
      limit: Math.min(Math.max(Number(sp.get("limit") ?? 50), 1), 100),
      offset: Math.max(Number(sp.get("offset") ?? 0), 0),
      status: statusParam && DSAR_STATUSES.includes(statusParam as DsarStatus) ? (statusParam as DsarStatus) : undefined,
      requestType: typeParam && DSAR_TYPES.includes(typeParam as DsarType) ? (typeParam as DsarType) : undefined,
    }
    try {
      return NextResponse.json(await listDsar(organizationId, opts))
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list DSAR requests"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["legal:read"] },
)

/** POST /api/v1/legal/dsar — create a DSAR request. Requires legal:write. */
const create = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const invalid = validateDsar(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
    try {
      const request = await createDsar(organizationId, userId, body as unknown as DsarInput)
      await logAuthEvent({
        action: "legal.dsar_created",
        userId,
        organizationId,
        resourceType: "dsar_request",
        resourceId: request.id,
        metadata: { request_type: request.request_type, subject_email: request.subject_email, due_at: request.due_at },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ request }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to create DSAR request"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["legal:write"] },
)

export { list as GET, create as POST }
