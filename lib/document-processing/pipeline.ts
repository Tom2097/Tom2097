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

  // classification isn't part of the read-modify-write race below (it's an
  // unconditional overwrite, not merged with a prior value), so it's set
  // directly. metadata, by contrast, is merged atomically in Postgres via
  // the merge_document_metadata RPC (jsonb `||` concatenation executed
  // server-side) instead of read-then-write in application code -- this
  // pipeline and /api/v1/operations/summarize both touch the same
  // documents.metadata column, and a plain read-modify-write here would
  // silently lose whichever write finished first when both run for the
  // same document concurrently.
  await db.from('documents').update({ classification }).eq('id', documentId)
  await db.rpc('merge_document_metadata', {
    p_document_id: documentId,
    p_organization_id: organizationId,
    p_patch: { analysis, analysis_duration_ms: analysisDurationMs },
  })

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
