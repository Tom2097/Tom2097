import { generateObject } from 'ai'
import { z } from 'zod'
import { mistralFastModel } from '@/lib/ai/mistral'

const MAX_CONTENT_CHARS = 8000

const AnalysisSchema = z.object({
  documentType: z.string().describe("A short 1-3 word classification, e.g. 'Invoice', 'Contract', 'Government Notice', 'Report'"),
  summary: z.string().describe('A 1-2 sentence plain-English summary of the document\'s content and purpose'),
  keyFields: z.record(z.string(), z.string()).describe('Up to 6 key-value pairs of the most important facts in the document (e.g. dates, amounts, reference numbers, names)'),
})

export type DocumentAnalysis = z.infer<typeof AnalysisSchema>

export async function analyzeDocument(content: string, filename: string): Promise<DocumentAnalysis> {
  const truncated = content.length > MAX_CONTENT_CHARS ? content.slice(0, MAX_CONTENT_CHARS) : content

  const { object } = await generateObject({
    model: mistralFastModel,
    schema: AnalysisSchema,
    prompt: `Analyze this document and extract a classification, a short summary, and key fields.

Filename: ${filename}

Content:
${truncated}`,
  })

  return object
}
