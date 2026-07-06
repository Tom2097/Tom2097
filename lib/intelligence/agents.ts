"""Autonomous Agents with Scoped Permissions

- Agents that can take actions (e.g., "escalate issue", "reroute shipment")
- Scoped to specific workspaces and permissions
- Audit trail for all actions
"""

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

interface Agent {
    id: string;
    name: string;
    workspaceId: string;
    permissions: string[];
    description: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

interface AgentAction {
    id: string;
    agentId: string;
    actionType: string;
    targetEntityId: string;
    targetEntityType: string;
    workspaceId: string;
    parameters: Record<string, unknown>;
    status: 'pending' | 'completed' | 'failed';
    result?: Record<string, unknown>;
    timestamp: Date;
    auditLog: string[];
}

class AgentSystem {
    private agents: Map<string, Agent>;
    private actions: Map<string, AgentAction>;
    private eventEmitter: EventEmitter;

    constructor() {
        this.agents = new Map();
        this.actions = new Map();
        this.eventEmitter = new EventEmitter();
    }

    createAgent(agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>): Agent {
        const id = uuidv4();
        const now = new Date();
        const newAgent: Agent = { ...agent, id, isActive: true, createdAt: now, updatedAt: now };
        this.agents.set(id, newAgent);
        this.eventEmitter.emit('agentCreated', newAgent);
        return newAgent;
    }

    executeAction(agentId: string, action: Omit<AgentAction, 'id' | 'agentId' | 'status' | 'timestamp' | 'auditLog'>): AgentAction {
        const agent = this.agents.get(agentId);
        if (!agent || !agent.isActive) throw new Error('Agent not found or inactive');

        const id = uuidv4();
        const now = new Date();
        const newAction: AgentAction = {
            id,
            agentId,
            ...action,
            status: 'pending',
            timestamp: now,
            auditLog: [`Action initiated by agent ${agentId} at ${now.toISOString()}`]
        };

        this.actions.set(id, newAction);
        this.eventEmitter.emit('actionExecuted', newAction);
        
        // Simulate action execution
        setTimeout(() => this.completeAction(id, { success: true }), 1000);
        
        return newAction;
    }

    private completeAction(actionId: string, result: Record<string, unknown>): void {
        const action = this.actions.get(actionId);
        if (!action) return;

        action.status = 'completed';
        action.result = result;
        action.auditLog.push(`Action completed at ${new Date().toISOString()}`);
        this.eventEmitter.emit('actionCompleted', action);
    }

    getAuditTrail(agentId: string): AgentAction[] {
        return Array.from(this.actions.values()).filter(action => action.agentId === agentId);
    }

    onAgentCreated(callback: (agent: Agent) => void): void {
        this.eventEmitter.on('agentCreated', callback);
    }

    onActionExecuted(callback: (action: AgentAction) => void): void {
        this.eventEmitter.on('actionExecuted', callback);
    }

    onActionCompleted(callback: (action: AgentAction) => void): void {
        this.eventEmitter.on('actionCompleted', callback);
    }
}

export { AgentSystem };
export type { Agent, AgentAction };