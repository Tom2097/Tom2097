import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { deleteCompany, getCompany, updateCompany } from "@/lib/crm/engine"
import type { CompanyUpdateInput } from "@/lib/crm/types"

/** Extract id from /api/v1/crm/companies/:id. */
function idFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("companies")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/** GET — fetch one. Requires crm:read. */
const get = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const company = await getCompany(organizationId, id)
      if (!company) return NextResponse.json({ error: "not found" }, { status: 404 })
      return NextResponse.json({ company })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to fetch company"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["crm:read"] },
)

/** PATCH — edit. Requires crm:write. */
const patch = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    let body: CompanyUpdateInput
    try {
      body = (await req.json()) as CompanyUpdateInput
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    try {
      const updated = await updateCompany(organizationId, id, body)
      if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "crm.company_updated",
        userId,
        organizationId,
        resourceType: "crm_company",
        resourceId: id,
        metadata: { fields: Object.keys(body ?? {}) },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ company: updated })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to update company"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["crm:write"] },
)

/** DELETE — remove. Requires crm:manage. */
const remove = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const ok = await deleteCompany(organizationId, id)
      if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "crm.company_deleted",
        userId,
        organizationId,
        resourceType: "crm_company",
        resourceId: id,
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to delete company"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["crm:manage"] },
)

export { get as GET, patch as PATCH, remove as DELETE }
