import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { listCustomerAccounts, updateCustomerAccount, getCustomerAccount } from "@/lib/crm/extensions"
import type { CustomerAccountUpdateInput, AccountHealthStatus } from "@/lib/crm/types"

export const GET = withAuth(async (req: NextRequest, { organizationId }) => {
  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get("companyId")
  if (companyId) {
    const account = await getCustomerAccount(organizationId, companyId)
    return NextResponse.json(account ?? { error: "not found" }, { status: account ? 200 : 404 })
  }
  const result = await listCustomerAccounts(organizationId, {
    healthStatus: searchParams.get("healthStatus") as AccountHealthStatus | undefined,
    limit: Number(searchParams.get("limit")) || 50,
    offset: Number(searchParams.get("offset")) || 0,
  })
  return NextResponse.json(result)
}, { requireAll: ["crm:read"] })

export async function PATCH(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
  const auth = withAuth(async (req: NextRequest, { organizationId }) => {
    const body: CustomerAccountUpdateInput = await req.json()
    const account = await updateCustomerAccount(organizationId, id, body)
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 })
    return NextResponse.json(account)
  }, { requireAll: ["crm:write"] })
  return auth(req)
}
