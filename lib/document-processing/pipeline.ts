import { createServiceClient } from '@/lib/supabase/service'
import { analyzeDocument, type DocumentAnalysis } from '@/lib/document-processing/analyze'
import { classifyText } from '@/lib/analytics/nlp'
import { triggerAutoActions } from '@/lib/operational/actions'
import { classifyAndRoute } from '@/lib/operational/routing'

export interface PipelineResult {
  analysis: DocumentAnalysis | { status: 'failed' }
  classification: string | null
  autoActions?: { tasks_created: string[]; recipe_results: string[] }
  routedTo?: string
}

/**
 * Runs a document's text through classification + analysis, persists both to
 * the document row, then fires auto-task creation (CAPA/payables) and any
 * matching recipe. Shared by upload, URL ingestion, and OCR so all three
 * intake paths get identical "understanding + action" behavior.
 */
export async function runUnderstandingAndActions(
  organizationId: string,
  documentId: string,
  content: string,
  filename: string,
  userId: string,
): Promise<PipelineResult> {
  const db = createServiceClient()
  const startedAt = Date.now()

  let analysis: PipelineResult['analysis']
  let classification: string | null = null

  try {
    const [analysisResult, classificationResult] = await Promise.all([
      analyzeDocument(content, filename),
      classifyText(content.slice(0, 5000)),
    ])
    analysis = analysisResult
    classification = classificationResult.primary
  } catch (err) {
    console.error('[pipeline] analysis failed:', err)
    analysis = { status: 'failed' }
  }

  const analysisDurationMs = Date.now() - startedAt

  const { data: existing } = await db.from('documents').select('metadata').eq('id', documentId).single()
  const existingMetadata = (existing?.metadata as Record<string, unknown>) ?? {}

  await db
    .from('documents')
    .update({
      classification,
      metadata: { ...existingMetadata, analysis, analysis_duration_ms: analysisDurationMs },
    })
    .eq('id', documentId)

  let autoActions: PipelineResult['autoActions']
  if (classification) {
    try {
      autoActions = await triggerAutoActions(organizationId, documentId, content, classification, userId)
    } catch (err) {
      console.error('[pipeline] triggerAutoActions failed:', err)
    }
  }

  let routedTo: string | undefined
  try {
    routedTo = await classifyAndRoute(organizationId, documentId, content)
  } catch (err) {
    console.error('[pipeline] classifyAndRoute failed:', err)
  }

  return { analysis, classification, autoActions, routedTo }
}
