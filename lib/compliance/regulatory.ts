import { generateText } from "ai"
import { DEFAULT_CHAT_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"
import { createServiceClient } from "@/lib/supabase/service"

export interface RegulationHit {
  regulation: string
  framework: string
  confidence: number
  relevant_text: string
}

export async function classifyRegulatoryText(text: string): Promise<RegulationHit[]> {
  const systemPrompt = `${BASE_SYSTEM_PROMPT}
You are a regulatory compliance classifier. Identify which regulations/frameworks apply to the given text.
Available frameworks: GMP, ISO 9001, ISO 27001, GDPR, DPDP, HIPAA, SOX, FDA 21 CFR Part 11, OSHA, EPA.

Return ONLY a JSON array:
[{ "regulation": "GDPR Article 5", "framework": "GDPR", "confidence": 85, "relevant_text": "processing of personal data" }]`

  const result = await generateText({
    model: DEFAULT_CHAT_MODEL, system: systemPrompt,
    prompt: `Text:\n"""\n${text.slice(0, 8000)}\n"""\n\nClassify regulatory relevance:`,
    temperature: 0.1, maxTokens: 1500,
  })

  try {
    const m = result.text.match(/\[[\s\S]*\]/)
    if (m) return JSON.parse(m[0]) as RegulationHit[]
  } catch {}
  return []
}

export async function buildTraceabilityMatrix(organizationId: string, frameworkId: string): Promise<Array<{ control: string; evidence: string | null; status: string; gap: boolean }>> {
  const db = createServiceClient()
  const { data: controls } = await db.from("compliance_controls").select("*").eq("framework_id", frameworkId)
  const { data: evidence } = await db.from("compliance_evidence").select("*").eq("organization_id", organizationId).eq("framework_id", frameworkId)

  const evidenceMap = new Map((evidence ?? []).map((e: any) => [e.control_id, e as Record<string, unknown>]))
  return ((controls ?? []) as Array<{ id: string; name: string; description: string }>).map((c) => {
    const ev = evidenceMap.get(c.id) as Record<string, unknown> | undefined
    return {
      control: `${c.name}: ${c.description}`,
      evidence: (ev?.document_id as string) ?? null,
      status: (ev?.status as string) ?? "missing",
      gap: !ev || ev.status !== "compliant",
    }
  })
}

export async function runMockAudit(organizationId: string): Promise<{ question: string; answer: string; evidence: string[] }[]> {
  const db = createServiceClient()
  const { data: frameworks } = await db.from("compliance_frameworks").select("id, name").eq("organization_id", organizationId)
  const qa: Array<{ question: string; answer: string; evidence: string[] }> = []

  for (const fw of (frameworks ?? []) as Array<{ id: string; name: string }>) {
    const matrix = await buildTraceabilityMatrix(organizationId, fw.id)
    const gaps = matrix.filter((m) => m.gap)
    const compliant = matrix.filter((m) => !m.gap)

    if (gaps.length > 0) {
      const topGap = gaps[0]
      qa.push({
        question: `Is control "${topGap.control}" covered for ${fw.name}?`,
        answer: `No. Evidence is missing. This is a compliance gap that needs remediation.`,
        evidence: [],
      })
    }

    if (compliant.length > 0) {
      const topCompliant = compliant[0]
      qa.push({
        question: `Show evidence for control "${topCompliant.control}" under ${fw.name}.`,
        answer: `Control is compliant. Evidence document ID: ${topCompliant.evidence}.`,
        evidence: topCompliant.evidence ? [topCompliant.evidence] : [],
      })
    }
  }

  return qa
}
