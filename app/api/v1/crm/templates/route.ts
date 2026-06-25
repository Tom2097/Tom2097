import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { createTemplate, listTemplates } from "@/lib/crm/extensions"
import type { CommTemplateInput } from "@/lib/crm/types"

export const GET = withAuth(async (req: NextRequest, { organizationId }) => {
  const { searchParams } = new URL(req.url)
  const result = await listTemplates(organizationId, {
    channel: searchParams.get("channel") as any,
    category: searchParams.get("category") ?? undefined,
    limit: Number(searchParams.get("limit")) || 50,
    offset: Number(searchParams.get("offset")) || 0,
  })
  return NextResponse.json(result)
}, { requireAll: ["crm:read"] })

export const POST = withAuth(async (req: NextRequest, { organizationId }) => {
  const body: CommTemplateInput = await req.json()
  if (!body.name || !body.subject || !body.body) {
    return NextResponse.json({ error: "name, subject, and body are required" }, { status: 400 })
  }
  const template = await createTemplate(organizationId, body)
  return NextResponse.json(template, { status: 201 })
}, { requireAll: ["crm:write"] })
