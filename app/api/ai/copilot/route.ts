import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { extractTenantContext } from "@/lib/multitenant/context"
import { DEFAULT_CHAT_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"

export async function POST(request: NextRequest) {
  try {
    const ctx = await extractTenantContext()
    if (!ctx?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { message, history } = await request.json()
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message is required" }, { status: 400 })
    }

    const historyText = Array.isArray(history)
      ? history.map((m: { role: string; content: string }) => `${m.role}: ${m.content}`).join("\n")
      : ""

    const { text } = await generateText({
      model: DEFAULT_CHAT_MODEL,
      system: `${BASE_SYSTEM_PROMPT}\nYou are an operational copilot that helps users process documents, extract data, create tasks, and trigger workflows.`,
      prompt: `${historyText}\nuser: ${message}\nassistant:`,
    })

    return NextResponse.json({ response: text })
  } catch {
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 })
  }
}
