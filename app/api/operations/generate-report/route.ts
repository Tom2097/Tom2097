import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { extractTenantContext } from '@/lib/multitenant/context'

export async function POST(request: Request) {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId

    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 403 })
    }

    const { documentIds } = await request.json()

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: 'At least one document ID required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: documents, error } = await supabase
      .from('documents')
      .select('*')
      .in('id', documentIds)
      .eq('organization_id', orgId)

    if (error) {
      throw new Error(error.message)
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({ error: 'No documents found' }, { status: 404 })
    }

    const allData: Record<string, unknown>[] = []
    const allText: string[] = []

    for (const doc of documents) {
      if (doc.raw_data && Array.isArray(doc.raw_data)) {
        allData.push(...doc.raw_data)
      }
      if (doc.content) {
        allText.push(doc.content)
      }
    }

    let summary = ''
    let insights: Record<string, unknown> = {}

    if (allData.length > 0) {
      const numericColumns: Record<string, number[]> = {}
      const textColumns: Record<string, string[]> = {}

      for (const row of allData) {
        for (const [key, value] of Object.entries(row)) {
          if (typeof value === 'number') {
            if (!numericColumns[key]) numericColumns[key] = []
            numericColumns[key].push(value)
          } else if (typeof value === 'string') {
            if (!textColumns[key]) textColumns[key] = []
            textColumns[key].push(value)
          }
        }
      }

      const stats: Record<string, Record<string, number | string>> = {}
      for (const [col, values] of Object.entries(numericColumns)) {
        const sum = values.reduce((a, b) => a + b, 0)
        stats[col] = {
          count: values.length,
          sum: Math.round(sum * 100) / 100,
          average: Math.round((sum / values.length) * 100) / 100,
          min: Math.min(...values),
          max: Math.max(...values),
        }
      }

      for (const [col, values] of Object.entries(textColumns)) {
        const unique = [...new Set(values)]
        stats[col] = {
          count: values.length,
          unique_values: unique.length,
        }
      }

      insights = {
        total_rows: allData.length,
        columns: Object.keys(allData[0] || {}),
        statistics: stats,
      }

      summary = `Analysis of ${documents.length} document(s) with ${allData.length} total data rows found across ${Object.keys(insights.columns || {}).length} columns.`
    } else {
      const combinedText = allText.join('\n\n')
      summary = `Processed ${documents.length} document(s). Total text length: ${combinedText.length} characters.`
      insights = {
        document_count: documents.length,
        total_characters: combinedText.length,
        word_count: combinedText.split(/\s+/).filter(Boolean).length,
      }
    }

    const { error: reportError } = await supabase
      .from('document_reports')
      .insert({
        organization_id: orgId,
        document_ids: documentIds,
        report_type: allData.length > 0 ? 'tabular_analysis' : 'text_summary',
        summary,
        insights,
      })

    if (reportError) {
      console.error('[generate-report] Failed to save report:', reportError)
    }

    return NextResponse.json({
      success: true,
      report: {
        summary,
        insights,
        documents_analyzed: documents.length,
      },
    })
  } catch (error) {
    console.error('[generate-report] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate report' },
      { status: 500 }
    )
  }
}