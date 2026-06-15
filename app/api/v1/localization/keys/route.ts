import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { createKey, listKeys, validateKey } from "@/lib/localization/engine"
import type { ListKeysOptions, TranslationKeyInput } from "@/lib/localization/types"

/** GET /api/v1/localization/keys — list. Requires localization:read. */
const list = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const sp = req.nextUrl.searchParams
    const opts: ListKeysOptions = {
      namespace: sp.get("namespace") ?? undefined,
      search: sp.get("search") ?? undefined,
      includeArchived: sp.get("includeArchived") === "true",
      limit: Math.min(Math.max(Number(sp.get("limit") ?? 200), 1), 500),
      offset: Math.max(Number(sp.get("offset") ?? 0), 0),
    }
    try {
      return NextResponse.json({ keys: await listKeys(organizationId, opts) })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list keys"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["localization:read"] },
)

/** POST /api/v1/localization/keys — create. Requires localization:write. */
const create = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const invalid = validateKey(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
    try {
      const key = await createKey(organizationId, userId, body as unknown as TranslationKeyInput)
      await logAuthEvent({
        action: "localization.key_created",
        userId,
        organizationId,
        resourceType: "translation_key",
        resourceId: key.id,
        metadata: { namespace: key.namespace, key: key.key },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ key }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to create key"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["localization:write"] },
)

export { list as GET, create as POST }
