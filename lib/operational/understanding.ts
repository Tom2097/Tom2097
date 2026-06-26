import { classifyText, generateSummary, extractEntities } from "@/lib/analytics/nlp"
import { extractFields, INVOICE_SCHEMA, CONTRACT_SCHEMA, type ExtractedField, type ExtractionSchema } from "@/lib/extraction/engine"
import { createServiceClient } from "@/lib/supabase/service"
import { dispatchDocumentEvent } from "@/lib/documents/events"

export interface UnderstandingResult {
  classification: { primary: string; confidence: number; secondary: string[] } | null
  summary: { summary: string; keyPoints: string[] } | null
  entities: Array<{ text: string; type: string; confidence: number }> | null
  extracted_fields: ExtractedField[] | null
}

export const OPS_EXTRACTION_SCHEMAS: Record<string, ExtractionSchema> = {
  invoice: INVOICE_SCHEMA,
  contract: CONTRACT_SCHEMA,
  inspection: {
    name: "inspection",
    fields: [
      { name: "facility", type: "string", description: "Facility or site name" },
      { name: "inspector", type: "string", description: "Inspector name" },
      { name: "inspection_date", type: "date", description: "Date of inspection" },
      { name: "findings_minor", type: "number", description: "Number of minor findings" },
      { name: "findings_major", type: "number", description: "Number of major findings" },
      { name: "findings_critical", type: "number", description: "Number of critical findings" },
      { name: "corrective_actions", type: "string", description: "Required corrective actions" },
      { name: "overall_status", type: "string", description: "Overall status (pass/fail/pending)" },
    ],
  },
  meeting: {
    name: "meeting",
    fields: [
      { name: "meeting_title", type: "string", description: "Meeting title or subject" },
      { name: "date", type: "date", description: "Meeting date" },
      { name: "attendees", type: "string", description: "List of attendees" },
      { name: "action_items", type: "string", description: "Action items assigned" },
      { name: "decisions", type: "string", description: "Key decisions made" },
      { name: "next_meeting", type: "date", description: "Next meeting date" },
    ],
  },
  report: {
    name: "report",
    fields: [
      { name: "title", type: "string", description: "Report title" },
      { name: "author", type: "string", description: "Report author" },
      { name: "date", type: "date", description: "Report date" },
      { name: "key_findings", type: "string", description: "Key findings or conclusions" },
      { name: "recommendations", type: "string", description: "Recommendations" },
    ],
  },
}

export async function classifyDocument(
  organizationId: string, documentId: string, content: string,
): Promise<{ primary: string; confidence: number; secondary: string[] } | null> {
  const result = await classifyText(content.slice(0, 5000)).catch(() => null)
  if (!result) return null

  const db = createServiceClient()
  await db.from("documents").update({ classification: result.primary }).eq("id", documentId)

  await dispatchDocumentEvent({
    type: "document.classified",
    organization_id: organizationId, document_id: documentId, actor_id: null,
    metadata: { classification: result.primary, confidence: result.confidence },
  })

  return { primary: result.primary, confidence: result.confidence, secondary: result.secondary }
}

export async function extractDocumentFields(
  organizationId: string, documentId: string, content: string, schemaName?: string,
): Promise<ExtractedField[]> {
  const classification = await classifyText(content.slice(0, 2000)).catch(() => null)
  const detectedSchema = schemaName ?? (classification?.primary
    ? (OPS_EXTRACTION_SCHEMAS[classification.primary] ? classification.primary : null)
    : null)

  const schema = detectedSchema ? OPS_EXTRACTION_SCHEMAS[detectedSchema] : null
  if (!schema) return []

  const fields = await extractFields(content.slice(0, 10000), schema)

  if (fields.length > 0) {
    const db = createServiceClient()
    await db.from("documents").update({ extracted_entities: fields as unknown as Record<string, unknown> }).eq("id", documentId)

    await dispatchDocumentEvent({
      type: "document.extracted",
      organization_id: organizationId, document_id: documentId, actor_id: null,
      metadata: { schema: schema.name, field_count: fields.length },
    })
  }

  return fields
}

export async function summarizeDocument(
  organizationId: string, documentId: string, content: string,
): Promise<{ summary: string; keyPoints: string[] } | null> {
  const result = await generateSummary(content.slice(0, 8000)).catch(() => null)
  if (!result) return null

  const db = createServiceClient()
  await db.from("documents").update({
    metadata: { summary: result.summary, key_points: result.keyPoints, summarized_at: new Date().toISOString() },
  }).eq("id", documentId)

  return { summary: result.summary, keyPoints: result.keyPoints }
}

export async function extractDocumentEntities(
  organizationId: string, documentId: string, content: string,
): Promise<Array<{ text: string; type: string; confidence: number }> | null> {
  const result = await extractEntities(content.slice(0, 5000)).catch(() => null)
  if (!result) return null

  const db = createServiceClient()
  await db.from("documents").update({
    metadata: { entities: result.entities, entity_counts: result.counts, entities_extracted_at: new Date().toISOString() },
  }).eq("id", documentId)

  return result.entities.map((e) => ({ text: e.text, type: e.type, confidence: e.confidence }))
}

export async function understandDocument(
  organizationId: string, documentId: string, content: string,
): Promise<UnderstandingResult> {
  const [classification, summary, entities, extracted] = await Promise.all([
    classifyDocument(organizationId, documentId, content),
    summarizeDocument(organizationId, documentId, content),
    extractDocumentEntities(organizationId, documentId, content),
    extractDocumentFields(organizationId, documentId, content),
  ])

  return { classification, summary, entities, extracted_fields: extracted }
}
