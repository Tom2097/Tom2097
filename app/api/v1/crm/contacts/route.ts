import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { createContact, listContacts, validateContact } from "@/lib/crm/engine"
import type { ContactInput, ContactStatus, ListContactsOptions } from "@/lib/crm/types"

/** GET /api/v1/crm/contacts — list. Requires crm:read. */
const list = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const sp = req.nextUrl.searchParams
    const opts: ListContactsOptions = {
      limit: Math.min(Math.max(Number(sp.get("limit") ?? 50), 1), 100),
      offset: Math.max(Number(sp.get("offset") ?? 0), 0),
      search: sp.get("search") ?? undefined,
      status: (sp.get("status") as ContactStatus | null) ?? undefined,
      companyId: sp.get("companyId") ?? undefined,
    }
    try {
      return NextResponse.json(await listContacts(organizationId, opts))
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list contacts"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["crm:read"] },
)

/** POST /api/v1/crm/contacts — create. Requires crm:write. */
const create = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const invalid = validateContact(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    try {
      const contact = await createContact(organizationId, userId, body as unknown as ContactInput)
      await logAuthEvent({
        action: "crm.contact_created",
        userId,
        organizationId,
        resourceType: "crm_contact",
        resourceId: contact.id,
        metadata: { email: contact.email },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ contact }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to create contact"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["crm:write"] },
)

export { list as GET, create as POST }
