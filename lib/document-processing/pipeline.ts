import { createServiceClient } from '@/lib/supabase/service'
import { analyzeDocument, type DocumentAnalysis } from '@/lib/document-processing/analyze'
import { classifyText, extractEntities } from '@/lib/analytics/nlp'
import { triggerAutoActions } from '@/lib/operational/actions'
import { classifyAndRoute } from '@/lib/operational/routing'
import { populateCrmFromExtraction } from '@/lib/documents/populate-crm'
import { publish } from '@/lib/events/bus'

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

  // Entity extraction feeds populateCrmFromExtraction below -- it runs
  // alongside analysis/classification but is independently fallible: a
  // failure here shouldn't fail the document's classification, and vice
  // versa, so each branch gets its own catch instead of one shared Promise.all.
  const [analysisOutcome, entityOutcome] = await Promise.all([
    Promise.all([analyzeDocument(content, filename), classifyText(content.slice(0, 5000))])
      .then(([analysisResult, classificationResult]) => ({ analysis: analysisResult, classification: classificationResult.primary }))
      .catch((err) => {
        console.error('[pipeline] analysis failed:', err)
        return null
      }),
    extractEntities(content.slice(0, 5000)).catch((err) => {
      console.error('[pipeline] extractEntities failed:', err)
      return null
    }),
  ])

  if (analysisOutcome) {
    analysis = analysisOutcome.analysis
    classification = analysisOutcome.classification
  } else {
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

  // The document has finished AI analysis/classification -- announce it on
  // the event bus so other modules (e.g. anything subscribed via
  // event_job_subscriptions) can react. Only fires once we actually have a
  // classification; a failed/unclassified document has nothing real to report.
  if (classification) {
    await publish({
      type: 'operational.document_ingested',
      organization_id: organizationId,
      data: { document_id: documentId, classification },
    })
  }

  let autoActions: PipelineResult['autoActions']
  if (classification) {
    try {
      autoActions = await triggerAutoActions(organizationId, documentId, content, classification, userId)
    } catch (err) {
      console.error('[pipeline] triggerAutoActions failed:', err)
    }
  }

  // Link any customer/company entities this document mentions into the CRM.
  // Only attempted when entity extraction above actually succeeded --
  // populateCrmFromExtraction has nothing to work with otherwise.
  let crmLinked: { createdContactIds: string[]; createdCompanyIds: string[] } | undefined
  if (entityOutcome) {
    try {
      crmLinked = await populateCrmFromExtraction(organizationId, documentId, {
        entities: entityOutcome.entities,
        counts: entityOutcome.counts,
      })
    } catch (err) {
      console.error('[pipeline] populateCrmFromExtraction failed:', err)
    }
  }

  let routedTo: string | undefined
  try {
    routedTo = await classifyAndRoute(organizationId, documentId, content)
  } catch (err) {
    console.error('[pipeline] classifyAndRoute failed:', err)
  }

  // The routing decision is made -- if CRM linking above actually created a
  // real record, announce it. Never publish this with an empty/fake
  // entity_id, so skip entirely when nothing was linked.
  if (crmLinked) {
    for (const contactId of crmLinked.createdContactIds) {
      await publish({
        type: 'operational.record_populated',
        organization_id: organizationId,
        data: { entity_type: 'crm_contact', entity_id: contactId, source_document: documentId },
      })
    }
    for (const companyId of crmLinked.createdCompanyIds) {
      await publish({
        type: 'operational.record_populated',
        organization_id: organizationId,
        data: { entity_type: 'crm_company', entity_id: companyId, source_document: documentId },
      })
    }
  }

  return { analysis, classification, autoActions, routedTo }
}
