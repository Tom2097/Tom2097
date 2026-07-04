import { NextRequest, NextResponse } from "next/server"
import { validateDiscountCode } from "@/lib/billing/discounts"

export async function POST(req: NextRequest) {
  const { code, planId } = await req.json()
  if (!code || !planId) {
    return NextResponse.json({ valid: false, error: "Code and planId required" }, { status: 400 })
  }
  const result = validateDiscountCode(code, planId)
  return NextResponse.json({ valid: result.valid, error: result.error })
}
