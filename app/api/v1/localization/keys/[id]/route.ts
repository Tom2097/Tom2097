import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { deleteKey, updateKey } from "@/lib/localization/engine"
import type { TranslationKeyUpdateInput } from "@/lib/localization/types"

function idFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("keys")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/** PATCH — edit / archive. Requires localization:write. */
const patch = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    let body: TranslationKeyUpdateInput
    try {
      body = (await req.json()) as TranslationKeyUpdateInput
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    try {
      const updated = await updateKey(organizationId, id, body)
      if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "localization.key_updated",
        userId,
        organizationId,
        resourceType: "translation_key",
        resourceId: id,
        metadata: { fields: Object.keys(body ?? {}) },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ key: updated })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to update key"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["localization:write"] },
)

/** DELETE — remove key (cascades its translations). Requires localization:manage. */
const remove = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const ok = await deleteKey(organizationId, id)
      if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "localization.key_deleted",
        userId,
        organizationId,
        resourceType: "translation_key",
        resourceId: id,
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to delete key"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["localization:manage"] },
)

export { patch as PATCH, remove as DELETE }
