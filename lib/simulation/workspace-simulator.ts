import { generateId } from '@/lib/utils/id'

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
  committedAt?: string
}

export interface SimulationDiff {
  additions: string[]
  modifications: { field: string; from: unknown; to: unknown }[]
  deletions: string[]
  scoreImpact?: number
  riskLevel: 'low' | 'medium' | 'high'
}

const simulations = new Map<string, Simulation>()

export function createSimulation(workspaceId: string, changes: SimulationChange[]): Simulation {
  const simulation: Simulation = {
    id: generateId(),
    workspaceId,
    changes,
    status: 'draft',
    createdAt: new Date().toISOString(),
  }
  simulations.set(simulation.id, simulation)
  return simulation
}

export function compareSimulation(simulationId: string): SimulationDiff {
  const simulation = simulations.get(simulationId)
  if (!simulation) throw new Error('Simulation not found')

  const additions: string[] = []
  const modifications: { field: string; from: unknown; to: unknown }[] = []
  const deletions: string[] = []

  for (const change of simulation.changes) {
    if (change.oldValue === null || change.oldValue === undefined) {
      additions.push(change.field)
    } else if (change.newValue === null || change.newValue === undefined) {
      deletions.push(change.field)
    } else {
      modifications.push({ field: change.field, from: change.oldValue, to: change.newValue })
    }
  }

  const changeCount = simulation.changes.length
  const scoreImpact = changeCount > 0 ? Math.round((changeCount + Math.random() * 10) * 10) / 10 : undefined
  const riskLevel: 'low' | 'medium' | 'high' =
    deletions.length > 3 ? 'high' : deletions.length > 0 ? 'medium' : 'low'

  return { additions, modifications, deletions, scoreImpact, riskLevel }
}

export async function commitSimulation(simulationId: string): Promise<void> {
  const simulation = simulations.get(simulationId)
  if (!simulation) throw new Error('Simulation not found')
  simulation.status = 'committed'
  simulation.committedAt = new Date().toISOString()
}

export async function discardSimulation(simulationId: string): Promise<void> {
  const simulation = simulations.get(simulationId)
  if (!simulation) throw new Error('Simulation not found')
  simulation.status = 'discarded'
}

export function listSimulations(workspaceId: string): Simulation[] {
  return Array.from(simulations.values())
    .filter(s => s.workspaceId === workspaceId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function updateSimulationStatus(simulationId: string, status: Simulation['status']): Simulation {
  const simulation = simulations.get(simulationId)
  if (!simulation) throw new Error('Simulation not found')
  simulation.status = status
  if (status === 'committed') simulation.committedAt = new Date().toISOString()
  return simulation
}
