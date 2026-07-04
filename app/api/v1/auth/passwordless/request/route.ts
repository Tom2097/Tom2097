"use server"

import { NextResponse } from "next/server"
import { sendMagicLink } from "@/lib/auth/passwordless/service"

export async function POST(request: Request) {
  const { email } = await request.json()

  if (!email) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 }
    )
  }

  try {
    await sendMagicLink({ email })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to send passcode" },
      { status: 500 }
    )
  }
}