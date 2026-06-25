import { NextRequest, NextResponse } from "next/server"
import { predictRUL } from "@/lib/predictive/maintenance"

export async function POST(req: NextRequest) {
  try {
    const { telemetry, threshold } = await req.json()
    if (!telemetry?.length) return NextResponse.json({ error: "No telemetry data" }, { status: 400 })
    const result = predictRUL(telemetry, threshold)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
