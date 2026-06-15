import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getBundle } from "@/lib/localization/engine"

/**
 * GET /api/v1/localization/bundle?locale=fr&reviewedOnly=true
 * Returns a flattened { namespaces: { ns: { key: value } } } bundle for runtime
 * i18n consumption. Requires localization:read.
 */
const get = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const code = req.nextUrl.searchParams.get("locale")
    if (!code) return NextResponse.json({ error: "locale query param is required" }, { status: 400 })
    const reviewedOnly = req.nextUrl.searchParams.get("reviewedOnly") === "true"
    try {
      const bundle = await getBundle(organizationId, code, { reviewedOnly })
      if (!bundle) return NextResponse.json({ error: "locale not found" }, { status: 404 })
      return NextResponse.json(bundle)
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to build bundle"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["localization:read"] },
)

export { get as GET }
