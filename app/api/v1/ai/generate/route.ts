import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json([])
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    return NextResponse.json({
      generated: body,
      result: "Content generated.",
    })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
