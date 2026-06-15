import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { createLocale, listLocales, validateLocale } from "@/lib/localization/engine"
import type { LocaleInput } from "@/lib/localization/types"

/** GET /api/v1/localization/locales — list. Requires localization:read. */
const list = withAuth(
  async (_req: NextRequest, { organizationId }) => {
    try {
      return NextResponse.json({ locales: await listLocales(organizationId) })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list locales"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["localization:read"] },
)

/** POST /api/v1/localization/locales — create. Requires localization:write. */
const create = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const invalid = validateLocale(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
    try {
      const locale = await createLocale(organizationId, userId, body as unknown as LocaleInput)
      await logAuthEvent({
        action: "localization.locale_created",
        userId,
        organizationId,
        resourceType: "locale",
        resourceId: locale.id,
        metadata: { code: locale.code, isDefault: locale.is_default },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ locale }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to create locale"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["localization:write"] },
)

export { list as GET, create as POST }
