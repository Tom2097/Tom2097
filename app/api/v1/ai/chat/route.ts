import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json([])
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    return NextResponse.json({
      message: body,
      response: "Assistant response.",
    })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
