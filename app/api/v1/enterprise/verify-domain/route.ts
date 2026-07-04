import { withAuth } from "@/lib/auth/with-auth"
import { NextResponse } from "next/server"
import { resolveTxt } from "node:dns/promises"

export const POST = withAuth(async (req, { organizationId }) => {
  const { domain } = await req.json()

  if (!domain || typeof domain !== "string") {
    return NextResponse.json({ error: "Domain is required" }, { status: 400 })
  }

  const expected = `digit-verify=${domain.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`

  try {
    const records = await resolveTxt(domain)
    const txtRecords = records.flat()
    const verified = txtRecords.some(r => r.includes(expected))

    return NextResponse.json({
      verified,
      message: verified ? "Domain ownership confirmed" : `TXT record not found. Add "${expected}" to your DNS.`,
    })
  } catch {
    return NextResponse.json({
      verified: false,
      message: "Could not resolve DNS records for this domain. Ensure the domain is valid and DNS is propagated.",
    })
  }
})
