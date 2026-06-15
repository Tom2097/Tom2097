import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { listTranslations, upsertTranslation } from "@/lib/localization/engine"
import type { TranslationUpsertInput } from "@/lib/localization/types"

/** GET /api/v1/localization/translations?localeId=&keyId= — list. Requires localization:read. */
const list = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const sp = req.nextUrl.searchParams
    try {
      const translations = await listTranslations(organizationId, {
        localeId: sp.get("localeId") ?? undefined,
        keyId: sp.get("keyId") ?? undefined,
        limit: Math.min(Math.max(Number(sp.get("limit") ?? 500), 1), 1000),
        offset: Math.max(Number(sp.get("offset") ?? 0), 0),
      })
      return NextResponse.json({ translations })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list translations"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["localization:read"] },
)

/** PUT /api/v1/localization/translations — upsert a value. Requires localization:write. */
const upsert = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: TranslationUpsertInput
    try {
      body = (await req.json()) as TranslationUpsertInput
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    try {
      const translation = await upsertTranslation(organizationId, userId, body)
      await logAuthEvent({
        action: "localization.translation_updated",
        userId,
        organizationId,
        resourceType: "translation",
        resourceId: translation.id,
        metadata: { keyId: translation.key_id, localeId: translation.locale_id, status: translation.status },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ translation })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to save translation"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["localization:write"] },
)

export { list as GET, upsert as PUT, upsert as POST }
