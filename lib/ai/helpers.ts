import { generateText } from "ai"
import { mistralModel, mistralFastModel } from "./mistral"
import { BASE_SYSTEM_PROMPT } from "./config"

export async function generateAiResponse(
  prompt: string,
  system?: string,
  fast = false
): Promise<string> {
  try {
    const { text } = await generateText({
      model: fast ? mistralFastModel : mistralModel,
      system: system || BASE_SYSTEM_PROMPT,
      prompt,
    })
    return text
  } catch (err) {
    console.error("[ai] generateText failed:", err)
    return ""
  }
}

export async function generateStructuredResponse<T>(
  prompt: string,
  system: string,
  parser: (raw: string) => T,
  fallback: T
): Promise<T> {
  try {
    const text = await generateAiResponse(prompt, system)
    return parser(text)
  } catch {
    return fallback
  }
}
