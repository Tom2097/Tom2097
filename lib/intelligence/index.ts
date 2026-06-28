/**
 * Intelligence Brain — the perceive-reason-act loop that powers continuous
 * monitoring, causal reasoning, autonomous agents, and executive briefings.
 *
 * This module is the "brain" layer that sits on top of all other modules
 * (compliance, resources, crm, operations, analytics, workflows) and provides
 * cross-cutting intelligence capabilities.
 */

export * from "./types"
export * from "./engine"
export * from "./causal-chain"
export * from "./ranking"
export * from "./confidence"
export * from "./monitor"
export * from "./briefing"
export * from "./agents"
export * from "./operational-graph"
export * from "./predictive"
export * from "./network-effect"
export * from "./scheduler"
export * from "./event-perceiver"
export { executeIntelligenceAction, executeAllApprovedActions } from "./executor"
export * from "./simulation"
export * from "./sync"
export * from "./orchestrator"
export * from "./aggregator"
export * from "./learning"
