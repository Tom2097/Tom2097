import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { createContact, validateContact, updateContact, deleteContact } from "@/lib/crm/engine"
import type { ContactInput, ContactUpdateInput } from "@/lib/crm/types"

const listHandler = withAuth(async (_req: NextRequest, { organizationId }) => {
  try {
    const { listContacts } = await import("@/lib/crm/engine")
    const { search } = Object.fromEntries(new URL(_req.url).searchParams)
    const result = await listContacts(organizationId, { search, limit: 100 })
    return NextResponse.json(result)
  } catch (error) {
    console.log("[v0] list contacts error:", error)
    return NextResponse.json({ error: "Failed to list contacts" }, { status: 500 })
  }
})

const createHandler = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    try {
      const body: ContactInput = await req.json()
      const validationError = validateContact(body)
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 })
      }
      const contact = await createContact(organizationId, userId, body)
      return NextResponse.json(contact, { status: 201 })
    } catch (error) {
      console.log("[v0] create contact error:", error)
      return NextResponse.json({ error: "Failed to create contact" }, { status: 500 })
    }
  },
  { requireAll: ["crm:write"] },
)

export const GET = listHandler
export const POST = createHandler

export async function PATCH(req: NextRequest) {
  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const authHandler = withAuth(
    async (req: NextRequest, { organizationId }) => {
      try {
        const body: ContactUpdateInput = await req.json()
        const contact = await updateContact(organizationId, id, body)
        if (!contact) {
          return NextResponse.json({ error: "Contact not found" }, { status: 404 })
        }
        return NextResponse.json(contact)
      } catch (error) {
        console.log("[v0] update contact error:", error)
        return NextResponse.json({ error: "Failed to update contact" }, { status: 500 })
      }
    },
    { requireAll: ["crm:write"] },
  )

  return authHandler(req)
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const authHandler = withAuth(
    async (_req: NextRequest, { organizationId }) => {
      try {
        const deleted = await deleteContact(organizationId, id)
        if (!deleted) {
          return NextResponse.json({ error: "Contact not found" }, { status: 404 })
        }
        return NextResponse.json({ success: true })
      } catch (error) {
        console.log("[v0] delete contact error:", error)
        return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 })
      }
    },
    { requireAll: ["crm:write"] },
  )

  return authHandler(req)
}
