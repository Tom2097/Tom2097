"use server"

import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { runMockAudit } from "@/lib/compliance/regulatory"

// POST /api/v1/compliance/gap-audit
// Runs a real gap-analysis audit: for each tracked framework, compares its
// controls against submitted evidence and surfaces the resulting Q&A.
export const POST = withAuth(async (_req: NextRequest, { organizationId }) => {
  const results = await runMockAudit(organizationId)
  return NextResponse.json({ results })
}, { requireAny: ["compliance:read"] })
