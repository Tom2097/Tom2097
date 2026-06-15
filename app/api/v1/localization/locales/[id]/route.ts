import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { deleteLocale, getLocale, setDefaultLocale, updateLocale } from "@/lib/localization/engine"
import type { LocaleUpdateInput } from "@/lib/localization/types"

function idFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("locales")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/** GET — fetch one. Requires localization:read. */
const get = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const locale = await getLocale(organizationId, id)
      if (!locale) return NextResponse.json({ error: "not found" }, { status: 404 })
      return NextResponse.json({ locale })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to fetch locale"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["localization:read"] },
)

/**
 * PATCH — edit, or promote to default with ?default=true. Requires localization:write.
 */
const patch = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })

    if (req.nextUrl.searchParams.get("default") === "true") {
      try {
        const updated = await setDefaultLocale(organizationId, id)
        if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })
        await logAuthEvent({
          action: "localization.default_changed",
          userId,
          organizationId,
          resourceType: "locale",
          resourceId: id,
          metadata: { code: updated.code },
          ipAddress: getClientIp(req.headers),
        })
        return NextResponse.json({ locale: updated })
      } catch (err) {
        const message = err instanceof Error ? err.message : "failed to set default"
        return NextResponse.json({ error: message }, { status: 400 })
      }
    }

    let body: LocaleUpdateInput
    try {
      body = (await req.json()) as LocaleUpdateInput
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    try {
      const updated = await updateLocale(organizationId, id, body)
      if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "localization.locale_updated",
        userId,
        organizationId,
        resourceType: "locale",
        resourceId: id,
        metadata: { fields: Object.keys(body ?? {}) },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ locale: updated })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to update locale"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["localization:write"] },
)

/** DELETE — remove (default locale is protected). Requires localization:manage. */
const remove = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const result = await deleteLocale(organizationId, id)
      if (result === "not_found") return NextResponse.json({ error: "not found" }, { status: 404 })
      if (result === "is_default")
        return NextResponse.json({ error: "cannot delete the default locale" }, { status: 409 })
      await logAuthEvent({
        action: "localization.locale_deleted",
        userId,
        organizationId,
        resourceType: "locale",
        resourceId: id,
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to delete locale"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["localization:manage"] },
)

export { get as GET, patch as PATCH, remove as DELETE }
