import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json([])
}

export async function POST(request: Request) {
  try {
    const { data } = await request.json()
    return NextResponse.json({
      enriched: data,
      result: "Enrichment complete.",
    })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
