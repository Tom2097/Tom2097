import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { createServiceClient } from "@/lib/supabase/service"

interface FindingRow {
  id: string
  type: string
  title: string
  description: string
  impact_score: number
  confidence: number
  status: string
  detected_at: string
  source_module: string
  monetary_risk: number
  entity_id: string | null
  suggested_action: string | null
  requires_approval: boolean
}

// The Finding interface consumed by the AI Intelligence command center
// (components/digit/intelligence-command-center.tsx) is camelCase, but
// intelligence_findings' real columns are snake_case -- a plain select("*")
// sent raw DB rows straight to the client, so every camelCase field the UI
// reads (impactScore, sourceModule, monetaryRisk, detectedAt,
// suggestedAction, requiresApproval) was always undefined.
function toFinding(row: FindingRow) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    impactScore: row.impact_score,
    confidence: row.confidence,
    status: row.status,
    detectedAt: row.detected_at,
    sourceModule: row.source_module,
    monetaryRisk: row.monetary_risk,
    entityId: row.entity_id,
    suggestedAction: row.suggested_action,
    requiresApproval: row.requires_approval,
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "20")

    const db = createServiceClient()
    const { data, error } = await db
      .from("intelligence_findings")
      .select("*")
      .eq("organization_id", organizationId)
      .order("detected_at", { ascending: false })
      .limit(limit)

    if (error) throw error

    return NextResponse.json({ findings: (data ?? []).map(toFinding) })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
