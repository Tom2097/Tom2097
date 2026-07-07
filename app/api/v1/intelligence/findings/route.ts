import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "20")

    const db = createServiceClient()
    const { data, error } = await db
      .from("intelligence_findings")
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(limit)

    if (error) throw error

    return NextResponse.json({ findings: data || [] })
  } catch {
    return NextResponse.json({ findings: [] })
  }
}
