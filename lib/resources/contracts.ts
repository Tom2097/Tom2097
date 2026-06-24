import { generateText } from "ai"
import { DEFAULT_CHAT_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"
import { createServiceClient } from "@/lib/supabase/service"

export interface ContractClause {
  type: "obligation" | "penalty" | "renewal" | "termination" | "payment" | "other"
  text: string
  parties: string[]
  date?: string
}

export async function extractContractClauses(text: string): Promise<ContractClause[]> {
  const systemPrompt = `${BASE_SYSTEM_PROMPT}
Extract key clauses from this contract. Categories: obligation, penalty, renewal, termination, payment, other.
Return ONLY a JSON array:
[{ "type": "obligation", "text": "Party A shall...", "parties": ["Party A"], "date": "2025-01-01" }]`

  const result = await generateText({
    model: DEFAULT_CHAT_MODEL, system: systemPrompt,
    prompt: `Contract:\n"""\n${text.slice(0, 15000)}\n"""\n\nExtract clauses:`,
    temperature: 0.1, maxOutputTokens: 2000,
  })

  try { const m = result.text.match(/\[[\s\S]*\]/); if (m) return JSON.parse(m[0]) } catch {}
  return []
}

export async function setRenewalReminder(organizationId: string, documentId: string, expiryDate: string, daysBefore: number = 30): Promise<boolean> {
  const db = createServiceClient()
  const remindAt = new Date(new Date(expiryDate).getTime() - daysBefore * 86400000)
  const { error } = await db.from("renewal_reminders").insert({
    organization_id: organizationId, document_id: documentId,
    expiry_date: expiryDate, remind_at: remindAt.toISOString(), notified: false,
  })
  return !error
}
