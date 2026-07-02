import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { askAcrossDocuments } from "@/lib/operational/ask-docs"

const handler = withAuth(async (req: NextRequest, { organizationId }) => {
  try {
    const { question } = await req.json() as { question: string }
    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 })
    }

    const result = await askAcrossDocuments(organizationId, question)
    return NextResponse.json(result)
  } catch (err) {
    console.error("[ask-docs] Error:", err)
    return NextResponse.json({ error: "Failed to process question" }, { status: 500 })
  }
})

export const POST = handler
