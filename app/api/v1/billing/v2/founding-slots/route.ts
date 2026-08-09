import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

/** Public (no auth) -- the pricing page's founding-counter display. Spec
 *  section 2: "if the site says '50 founding slots,' the number remaining
 *  must be real." Reads founding_slots_public, a view exposing only the
 *  aggregate count (never subscription_id/organization_id). */
export async function GET() {
  const db = createServiceClient()
  const { data } = await db.from("founding_slots_public").select("*").single()
  return NextResponse.json({
    slotsRemaining: data?.slots_remaining ?? 0,
    slotsTotal: data?.slots_total ?? 50,
  })
}
