import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { deleteContact, getContact, updateContact } from "@/lib/crm/engine"
import type { ContactUpdateInput } from "@/lib/crm/types"

function idFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("contacts")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/** GET — fetch one. Requires crm:read. */
const get = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const contact = await getContact(organizationId, id)
      if (!contact) return NextResponse.json({ error: "not found" }, { status: 404 })
      return NextResponse.json({ contact })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to fetch contact"
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
    let body: ContactUpdateInput
    try {
      body = (await req.json()) as ContactUpdateInput
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    try {
      const updated = await updateContact(organizationId, id, body)
      if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "crm.contact_updated",
        userId,
        organizationId,
        resourceType: "crm_contact",
        resourceId: id,
        metadata: { fields: Object.keys(body ?? {}) },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ contact: updated })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to update contact"
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
      const ok = await deleteContact(organizationId, id)
      if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "crm.contact_deleted",
        userId,
        organizationId,
        resourceType: "crm_contact",
        resourceId: id,
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to delete contact"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["crm:manage"] },
)

export { get as GET, patch as PATCH, remove as DELETE }
