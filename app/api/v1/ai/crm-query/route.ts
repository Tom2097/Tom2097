import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json([])
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const query = body.query || body.prompt || ""

    return NextResponse.json({
      query,
      result: [],
      summary: "No results found for query.",
    })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
