import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get("limit") || "20")
  const ranked = searchParams.get("ranked") === "true"

  try {
    const db = createServiceClient()
    const query = db
      .from("intelligence_findings")
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(limit)

    if (ranked) {
      query.order("impact_score", { ascending: false })
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch findings" },
      { status: 500 }
    )
  }
}
