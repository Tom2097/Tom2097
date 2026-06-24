import { createServiceClient } from "@/lib/supabase/service"

interface ComplianceMetric {
  framework: string
  total_controls: number
  passed_controls: number
  score: number
  gaps: number
  last_assessed: string
}

export async function computeComplianceScore(organizationId: string): Promise<{
  overall: number
  by_framework: ComplianceMetric[]
}> {
  const db = createServiceClient()

  const { data: frameworks } = await db
    .from("compliance_frameworks")
    .select("id, name, controls_count")
    .eq("organization_id", organizationId)

  if (!frameworks || frameworks.length === 0) {
    return { overall: 0, by_framework: [] }
  }

  const byFramework: ComplianceMetric[] = []
  let totalControls = 0
  let totalPassed = 0

  for (const fw of frameworks as Array<{ id: string; name: string; controls_count: number }>) {
    const { count: passed } = await db
      .from("compliance_evidence")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("framework_id", fw.id)
      .eq("status", "compliant")

    const passedCount = passed ?? 0
    totalControls += fw.controls_count
    totalPassed += passedCount

    byFramework.push({
      framework: fw.name,
      total_controls: fw.controls_count,
      passed_controls: passedCount,
      score: fw.controls_count > 0 ? Math.round((passedCount / fw.controls_count) * 100) : 0,
      gaps: fw.controls_count - passedCount,
      last_assessed: new Date().toISOString(),
    })
  }

  return {
    overall: totalControls > 0 ? Math.round((totalPassed / totalControls) * 100) : 0,
    by_framework: byFramework,
  }
}
