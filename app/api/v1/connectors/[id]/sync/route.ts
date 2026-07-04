import { withAuth } from "@/lib/auth/with-auth"
import { syncConnector } from "@/lib/connectors/engine"
import { NextResponse } from "next/server"

export const POST = withAuth(async (req, { organizationId, params }) => {
  const { id } = params
  try {
    const result = await syncConnector(organizationId, id)
    return NextResponse.json({ result })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
})
