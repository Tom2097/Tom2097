import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { createCompany, listCompanies, validateCompany } from "@/lib/crm/engine"
import type { CompanyInput, ListCompaniesOptions } from "@/lib/crm/types"

/** GET /api/v1/crm/companies — list. Requires crm:read. */
const list = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const sp = req.nextUrl.searchParams
    const opts: ListCompaniesOptions = {
      limit: Math.min(Math.max(Number(sp.get("limit") ?? 50), 1), 100),
      offset: Math.max(Number(sp.get("offset") ?? 0), 0),
      search: sp.get("search") ?? undefined,
    }
    try {
      return NextResponse.json(await listCompanies(organizationId, opts))
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list companies"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["crm:read"] },
)

/** POST /api/v1/crm/companies — create. Requires crm:write. */
const create = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const invalid = validateCompany(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    try {
      const company = await createCompany(organizationId, userId, body as unknown as CompanyInput)
      await logAuthEvent({
        action: "crm.company_created",
        userId,
        organizationId,
        resourceType: "crm_company",
        resourceId: company.id,
        metadata: { name: company.name },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ company }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to create company"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["crm:write"] },
)

export { list as GET, create as POST }
