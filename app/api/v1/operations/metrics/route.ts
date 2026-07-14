import { NextResponse } from 'next/server'
import { extractTenantContext } from '@/lib/multitenant/context.server'
import { createServiceClient } from '@/lib/supabase/service'

interface RecentDoc {
  id: string
  created_at: string
  classification: string | null
  metadata: Record<string, unknown> | null
}

export async function GET() {
  const ctx = await extractTenantContext()
  if (!ctx?.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()
  const now = Date.now()
  const startOfToday = new Date(now - (now % 86400000)).toISOString()

  const [{ data: recentDocsRaw }, { data: taskRows }, { count: openCapas }, { count: whatsappMessages }, { count: emailMessages }] =
    await Promise.all([
      db
        .from('documents')
        .select('id, created_at, classification, metadata')
        .eq('organization_id', ctx.organizationId)
        .order('created_at', { ascending: false })
        .limit(300),
      db.from('document_tasks').select('document_id').eq('organization_id', ctx.organizationId),
      db.from('capa_records').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.organizationId).neq('status', 'closed'),
      db
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', ctx.organizationId)
        .eq('metadata->>source', 'whatsapp')
        .gte('created_at', startOfToday),
      db
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', ctx.organizationId)
        .or('metadata->>source.eq.email,metadata->>source.eq.email_attachment')
        .gte('created_at', startOfToday),
    ])

  const recentDocs = (recentDocsRaw ?? []) as RecentDoc[]
  const taskDocIds = new Set((taskRows ?? []).map((r) => r.document_id as string))

  const fiveMinAgo = now - 5 * 60 * 1000
  const docsLast5Min = recentDocs.filter((d) => new Date(d.created_at).getTime() >= fiveMinAgo)
  const ingestionRate = Math.round((docsLast5Min.length / 5) * 10) / 10

  const durations = recentDocs
    .map((d) => (d.metadata?.analysis_duration_ms as number | undefined))
    .filter((v): v is number => typeof v === 'number')
  const processingTime = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0

  const analyzed = recentDocs.filter((d) => d.metadata?.analysis)
  const analysisSuccessRate = analyzed.length > 0
    ? Math.round((analyzed.filter((d) => (d.metadata?.analysis as { status?: string })?.status !== 'failed').length / analyzed.length) * 100)
    : 0

  const classified = recentDocs.filter((d) => d.classification)
  const autoActionRate = classified.length > 0
    ? Math.round((classified.filter((d) => taskDocIds.has(d.id)).length / classified.length) * 100)
    : 0

  const chartBuckets: { name: string; value: number }[] = []
  const bucketMinutes = 20
  for (let i = bucketMinutes - 1; i >= 0; i--) {
    const bucketStart = now - i * 60 * 1000
    const bucketEnd = bucketStart + 60 * 1000
    const count = recentDocs.filter((d) => {
      const t = new Date(d.created_at).getTime()
      return t >= bucketStart && t < bucketEnd
    }).length
    chartBuckets.push({ name: new Date(bucketStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), value: count })
  }

  const anomalies = recentDocs
    .filter((d) => (d.metadata?.analysis as { status?: string })?.status === 'failed')
    .slice(0, 5)
    .map((d) => ({ id: d.id, type: 'analysis_failed', severity: 'medium', timestamp: d.created_at }))

  return NextResponse.json({
    ingestionRate,
    processingTime,
    analysisSuccessRate,
    autoActionRate,
    openCapas: openCapas ?? 0,
    whatsappMessages: whatsappMessages ?? 0,
    emailMessages: emailMessages ?? 0,
    chartData: chartBuckets,
    anomalies,
  })
}
