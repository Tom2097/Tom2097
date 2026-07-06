"""Causal Graph for Cross-Workspace Reasoning

- Builds a directed acyclic graph (DAG) to model causal relationships
- Identifies root causes and downstream effects of operational events
- Supports cross-workspace event tracing
"""

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

interface CausalNode {
    id: string;
    workspaceId: string;
    entityId: string;
    entityType: string;
    eventType: string;
    timestamp: Date;
    metadata: Record<string, unknown>;
}

interface CausalEdge {
    id: string;
    from: string;
    to: string;
    relationshipType: 'causes' | 'blocks' | 'depends_on' | 'triggers';
    confidence: number;
    metadata: Record<string, unknown>;
}

class CausalGraph {
    private nodes: Map<string, CausalNode>;
    private edges: Map<string, CausalEdge>;
    private eventEmitter: EventEmitter;

    constructor() {
        this.nodes = new Map();
        this.edges = new Map();
        this.eventEmitter = new EventEmitter();
    }

    addNode(node: Omit<CausalNode, 'id'>): CausalNode {
        const id = uuidv4();
        const newNode: CausalNode = { ...node, id };
        this.nodes.set(id, newNode);
        this.eventEmitter.emit('nodeAdded', newNode);
        return newNode;
    }

    addEdge(edge: Omit<CausalEdge, 'id'>): CausalEdge {
        const id = uuidv4();
        const newEdge: CausalEdge = { ...edge, id };
        this.edges.set(id, newEdge);
        this.eventEmitter.emit('edgeAdded', newEdge);
        return newEdge;
    }

    findRootCauses(nodeId: string): CausalNode[] {
        const rootCauses: CausalNode[] = [];
        const visited = new Set<string>();
        const queue: string[] = [nodeId];

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const incomingEdges = Array.from(this.edges.values()).filter(edge => edge.to === currentId);
            if (incomingEdges.length === 0) {
                const node = this.nodes.get(currentId);
                if (node) rootCauses.push(node);
            } else {
                incomingEdges.forEach(edge => queue.push(edge.from));
            }
        }

        return rootCauses;
    }

    findDownstreamEffects(nodeId: string): CausalNode[] {
        const downstreamEffects: CausalNode[] = [];
        const visited = new Set<string>();
        const queue: string[] = [nodeId];

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const outgoingEdges = Array.from(this.edges.values()).filter(edge => edge.from === currentId);
            outgoingEdges.forEach(edge => {
                const node = this.nodes.get(edge.to);
                if (node) {
                    downstreamEffects.push(node);
                    queue.push(edge.to);
                }
            });
        }

        return downstreamEffects;
    }

    onNodeAdded(callback: (node: CausalNode) => void): void {
        this.eventEmitter.on('nodeAdded', callback);
    }

    onEdgeAdded(callback: (edge: CausalEdge) => void): void {
        this.eventEmitter.on('edgeAdded', callback);
    }
}

export { CausalGraph };
export type { CausalNode, CausalEdge };