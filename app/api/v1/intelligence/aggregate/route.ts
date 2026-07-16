import { NextResponse } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { getBrainHealth, getEngineStatus } from '@/lib/intelligence/health'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const db = createServiceClient()

    const { data: workspaces } = await db.from('workspaces').select('id').eq('organization_id', organizationId)
    const workspaceIds = (workspaces ?? []).map((w) => w.id)

    const [health, engine, nodeCount, recentFindings] = await Promise.all([
      getBrainHealth(organizationId),
      getEngineStatus(),
      workspaceIds.length > 0
        ? db.from('operational_graph_nodes').select('id', { count: 'exact', head: true }).in('workspace_id', workspaceIds)
        : Promise.resolve({ count: 0 }),
      db
        .from('intelligence_findings')
        .select('id, source_module, monetary_risk, detected_at')
        .eq('organization_id', organizationId)
        .order('detected_at', { ascending: false })
        .limit(5),
    ])

    const findings = recentFindings.data ?? []
    const anomalies = findings.map((f) => ({
      id: f.id,
      type: f.source_module,
      severity: f.monetary_risk > 50000 ? 'high' : f.monetary_risk > 10000 ? 'medium' : 'low',
      timestamp: f.detected_at,
    }))

    // Findings-per-day over the last 10 days, as a real activity trend.
    const { data: trendRows } = await db
      .from('intelligence_findings')
      .select('detected_at')
      .eq('organization_id', organizationId)
      .gte('detected_at', new Date(Date.now() - 10 * 86400000).toISOString())

    const dayBuckets = new Map<string, number>()
    for (let i = 9; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      dayBuckets.set(d.toISOString().slice(0, 10), 0)
    }
    for (const row of trendRows ?? []) {
      const key = (row.detected_at as string).slice(0, 10)
      if (dayBuckets.has(key)) dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + 1)
    }
    const chartData = Array.from(dayBuckets.entries()).map(([day, count]) => ({
      name: day.slice(5),
      value: count,
      insights: count,
    }))

    return NextResponse.json({
      metrics: {
        agentStatus: health.tasksLast24h > 0 ? 'active' : 'idle',
        reasoningAccuracy: Math.max(0, 100 - health.taskFailureRate),
        graphComplexity: nodeCount.count ?? 0,
        anomalyDetection: health.criticalFindings,
        systemLoad: Math.min(1, Number((engine.memoryMb / 512).toFixed(2))),
        memoryUsage: Math.min(1, Number((engine.memoryMb / 512).toFixed(2))),
        activeAgents: health.tasksLast24h,
        insightsGenerated: health.totalFindings,
      },
      chartData,
      anomalies,
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
