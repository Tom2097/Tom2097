import "server-only"
import { createServiceClient } from "@/lib/supabase/service"

export interface SimulationChange {
  field: string
  oldValue: unknown
  newValue: unknown
}

export interface Simulation {
  id: string
  workspaceId: string
  changes: SimulationChange[]
  status: 'draft' | 'ready' | 'committed' | 'discarded'
  createdAt: string
  committedAt?: string | null
}

export interface SimulationDiff {
  additions: string[]
  modifications: { field: string; from: unknown; to: unknown }[]
  deletions: string[]
  scoreImpact?: number
  riskLevel: 'low' | 'medium' | 'high'
}

interface SimulationRow {
  id: string
  workspace_id: string
  changes: SimulationChange[]
  status: Simulation['status']
  created_at: string
  committed_at: string | null
}

function toSimulation(row: SimulationRow): Simulation {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    changes: row.changes ?? [],
    status: row.status,
    createdAt: row.created_at,
    committedAt: row.committed_at,
  }
}

export async function createSimulation(
  organizationId: string,
  workspaceId: string,
  changes: SimulationChange[],
  createdBy: string,
): Promise<Simulation | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("simulations")
    .insert({ organization_id: organizationId, workspace_id: workspaceId, changes, status: "draft", created_by: createdBy })
    .select("*")
    .single()
  if (error) return null
  return toSimulation(data as SimulationRow)
}

export async function compareSimulation(organizationId: string, simulationId: string): Promise<SimulationDiff> {
  const db = createServiceClient()
  const { data } = await db
    .from("simulations")
    .select("changes")
    .eq("id", simulationId)
    .eq("organization_id", organizationId)
    .maybeSingle()
  if (!data) throw new Error("Simulation not found")

  const changes = (data.changes as SimulationChange[]) ?? []
  const additions: string[] = []
  const modifications: { field: string; from: unknown; to: unknown }[] = []
  const deletions: string[] = []

  for (const change of changes) {
    if (change.oldValue === null || change.oldValue === undefined) {
      additions.push(change.field)
    } else if (change.newValue === null || change.newValue === undefined) {
      deletions.push(change.field)
    } else {
      modifications.push({ field: change.field, from: change.oldValue, to: change.newValue })
    }
  }

  const changeCount = changes.length
  const scoreImpact = changeCount > 0 ? Math.round(changeCount * 10) / 10 : undefined
  const riskLevel: 'low' | 'medium' | 'high' =
    deletions.length > 3 ? 'high' : deletions.length > 0 ? 'medium' : 'low'

  return { additions, modifications, deletions, scoreImpact, riskLevel }
}

export async function commitSimulation(organizationId: string, simulationId: string): Promise<void> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("simulations")
    .update({ status: "committed", committed_at: new Date().toISOString() })
    .eq("id", simulationId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle()
  if (error || !data) throw new Error("Simulation not found")
}

export async function discardSimulation(organizationId: string, simulationId: string): Promise<void> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("simulations")
    .update({ status: "discarded" })
    .eq("id", simulationId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle()
  if (error || !data) throw new Error("Simulation not found")
}

export async function listSimulations(organizationId: string, workspaceId: string): Promise<Simulation[]> {
  const db = createServiceClient()
  const { data } = await db
    .from("simulations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
  return ((data ?? []) as SimulationRow[]).map(toSimulation)
}

export async function updateSimulationStatus(
  organizationId: string,
  simulationId: string,
  status: Simulation['status'],
): Promise<Simulation | null> {
  const db = createServiceClient()
  const patch: Record<string, unknown> = { status }
  if (status === 'committed') patch.committed_at = new Date().toISOString()
  const { data, error } = await db
    .from("simulations")
    .update(patch)
    .eq("id", simulationId)
    .eq("organization_id", organizationId)
    .select("*")
    .maybeSingle()
  if (error || !data) return null
  return toSimulation(data as SimulationRow)
}
