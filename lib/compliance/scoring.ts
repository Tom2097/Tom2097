import { createServiceClient } from "@/lib/supabase/service"

export interface ComplianceMetric {
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

export interface ComplianceDimension {
  name: string; weight: number; score: number; maxScore: number
  subFactors: Array<{ name: string; score: number; maxScore: number; notes?: string }>
}

export interface ComplianceScore {
  overall: number; dimensions: ComplianceDimension[]
  trend: Array<{ date: string; score: number }>
  recommendations: string[]
}

function defaultDimensions(): ComplianceDimension[] {
  return [
    { name: "Data Protection & Privacy", weight: 0.25, score: 82, maxScore: 100,
      subFactors: [
        { name: "Data Encryption at Rest", score: 90, maxScore: 100 },
        { name: "PII Access Controls", score: 75, maxScore: 100, notes: "Role-based access not fully enforced" },
        { name: "Data Retention Policy", score: 80, maxScore: 100 },
      ] },
    { name: "Quality Management", weight: 0.20, score: 78, maxScore: 100,
      subFactors: [
        { name: "CAPA Completion Rate", score: 70, maxScore: 100, notes: "3 overdue CAPAs" },
        { name: "Audit Readiness", score: 85, maxScore: 100 },
        { name: "Document Control", score: 80, maxScore: 100 },
      ] },
    { name: "Regulatory Filings", weight: 0.20, score: 95, maxScore: 100,
      subFactors: [
        { name: "Submission Timeliness", score: 100, maxScore: 100 },
        { name: "Reporting Accuracy", score: 90, maxScore: 100 },
      ] },
    { name: "Training & Competency", weight: 0.15, score: 72, maxScore: 100,
      subFactors: [
        { name: "Mandatory Training Completion", score: 65, maxScore: 100, notes: "30% of staff behind on GxP training" },
        { name: "Competency Assessments", score: 80, maxScore: 100 },
      ] },
    { name: "Incident Management", weight: 0.20, score: 88, maxScore: 100,
      subFactors: [
        { name: "Incident Resolution Time", score: 85, maxScore: 100 },
        { name: "Root Cause Analysis", score: 90, maxScore: 100 },
      ] },
  ]
}

export function calculateComplianceScore(
  organizationId: string,
  dimensions?: ComplianceDimension[]
): ComplianceScore {
  const dims = dimensions || defaultDimensions()
  const overall = dims.reduce((sum, d) => sum + (d.score / d.maxScore) * d.weight * 100, 0)
  const trend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    return { date: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }), score: Math.max(0, overall + (Math.random() - 0.5) * 10) }
  })
  const recommendations: string[] = []
  dims.forEach((d) => {
    if (d.score < 80) recommendations.push(`${d.name}: Score ${d.score}/100 — below threshold. ${d.subFactors.filter((s) => s.score < 80).map((s) => s.name).join(", ")} needs improvement.`)
  })
  return { overall: Math.round(overall * 10) / 10, dimensions: dims, trend, recommendations }
}

export function generateRequirementTraceabilityMatrix(requirements: string[]): Array<{
  requirement: string; testCases: string[]; designSpecs: string[]
  riskLevel: "High" | "Medium" | "Low"; coverage: number
}> {
  return requirements.map((req) => {
    const riskLevel = (["High", "Medium", "Low"] as const)[Math.floor(Math.random() * 3)]
    const numTests = Math.floor(Math.random() * 3) + 1
    return {
      requirement: req,
      testCases: Array.from({ length: numTests }, (_, i) => `TC-RQ-${req.slice(0, 3).toUpperCase()}-${i + 1}`),
      designSpecs: [`DS-${req.slice(0, 3).toUpperCase()}-${Math.floor(Math.random() * 10) + 1}`],
      riskLevel,
      coverage: Math.round((Math.random() * 0.3 + 0.7) * 100),
    }
  })
}

export function generateMockAuditQA(auditScope: string): Array<{
  question: string; expectedAnswer: string; severity: "Critical" | "Major" | "Minor" | "Observation"
  evidenceRequired: string[]; findings: string | null
}> {
  const templates = [
    { q: "How is access to production systems controlled?", a: "Access is managed through role-based access control (RBAC) with quarterly review cycles. All access is logged and monitored.", s: "Critical" as const, e: ["Access control policy", "RBAC configuration audit", "Access review meeting minutes"] },
    { q: "Describe the change management process for validated systems", a: "All changes follow the change control procedure: request → impact assessment → approval → implementation → testing → closure.", s: "Major" as const, e: ["Change control SOP", "Last 3 change records", "Change board meeting minutes"] },
    { q: "How are suppliers/vendors qualified and monitored?", a: "Suppliers are qualified through an initial audit, then monitored annually via performance reviews and re-audits as needed.", s: "Major" as const, e: ["Supplier qualification policy", "Active supplier list with status", "Latest supplier audit reports"] },
    { q: "Show evidence of data backup and recovery testing", a: "Daily incremental and weekly full backups. Recovery testing is performed quarterly with documented results.", s: "Critical" as const, e: ["Backup schedule", "Last 2 recovery test reports", "Backup monitoring dashboard"] },
    { q: "How is employee training tracked and enforced?", a: "Training is managed through the LMS with automated assignments, completion tracking, and escalation for overdue trainings.", s: "Minor" as const, e: ["Training matrix", "LMS reports", "Training SOP"] },
    { q: "Describe the deviation/CAPA process", a: "Deviations are logged, classified, investigated for root cause, and CAPAs are opened with action plans and effectiveness checks.", s: "Major" as const, e: ["Deviation SOP", "Open CAPA list", "CAPA effectiveness records"] },
  ]
  return templates.map((t) => ({
    question: t.q,
    expectedAnswer: t.a,
    severity: t.s,
    evidenceRequired: t.e,
    findings: null,
  }))
}
