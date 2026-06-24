import { generateText } from "ai"
import { DEFAULT_CHAT_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"

export type DraftTone = "professional" | "friendly" | "formal" | "urgent" | "empathetic"

export interface DraftRequest {
  content: string
  tone: DraftTone
  context?: string
}

export interface DraftResult {
  subject: string
  body: string
  tone: DraftTone
  wordCount: number
}

export async function generateDraftResponse(request: DraftRequest): Promise<DraftResult> {
  const toneInstructions: Record<DraftTone, string> = {
    professional: "Use a professional, business-appropriate tone. Be clear and concise.",
    friendly: "Use a warm, conversational tone. Be approachable and personable.",
    formal: "Use formal language. Address with proper salutations and closings.",
    urgent: "Convey urgency and importance. Be direct and action-oriented.",
    empathetic: "Show understanding and empathy. Acknowledge feelings and concerns.",
  }

  const systemPrompt = `${BASE_SYSTEM_PROMPT}

You are an expert communication assistant. Generate a draft response based on the input content and specified tone.

${toneInstructions[request.tone]}

Return ONLY a JSON object with this structure:
{
  "subject": "A clear subject line",
  "body": "The full response body",
  "wordCount": number
}`

  const contextBlock = request.context
    ? `\n\nAdditional Context:\n"""\n${request.context}\n"""`
    : ""

  const result = await generateText({
    model: DEFAULT_CHAT_MODEL,
    system: systemPrompt,
    prompt: `Content to respond to:\n"""\n${request.content}\n"""\nTone: ${request.tone}${contextBlock}\n\nGenerate draft response:`,
    temperature: 0.4,
    maxOutputTokens: 1500,
  })

  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        subject: parsed.subject || "Re: Your message",
        body: parsed.body || result.text,
        tone: request.tone,
        wordCount: parsed.wordCount || parsed.body?.split(/\s+/).length || 0,
      }
    }
  } catch {
    // fall through
  }

  return {
    subject: "Re: Your message",
    body: result.text,
    tone: request.tone,
    wordCount: result.text.split(/\s+/).length,
  }
}
