import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { createQuote, listQuotes, updateQuoteStatus } from "@/lib/crm/extensions"
import type { QuoteInput, QuoteStatus } from "@/lib/crm/types"

export const GET = withAuth(async (req: NextRequest, { organizationId }) => {
  const { searchParams } = new URL(req.url)
  const result = await listQuotes(organizationId, {
    status: searchParams.get("status") as QuoteStatus | undefined,
    dealId: searchParams.get("dealId") ?? undefined,
    limit: Number(searchParams.get("limit")) || 50,
    offset: Number(searchParams.get("offset")) || 0,
  })
  return NextResponse.json(result)
}, { requireAll: ["crm:read"] })

export const POST = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  const body: QuoteInput = await req.json()
  if (!body.title) return NextResponse.json({ error: "title is required" }, { status: 400 })
  const quote = await createQuote(organizationId, userId, body)
  return NextResponse.json(quote, { status: 201 })
}, { requireAll: ["crm:write"] })

export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
  const auth = withAuth(async (req: NextRequest, { organizationId }) => {
    const { status } = await req.json()
    if (!status) return NextResponse.json({ error: "status is required" }, { status: 400 })
    const quote = await updateQuoteStatus(organizationId, id, status)
    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 })
    return NextResponse.json(quote)
  }, { requireAll: ["crm:write"] })
  return auth(req)
}
