"""Operational Graph: Entities + Relationships

- Models entities (e.g., customers, orders, shipments) as nodes
- Models relationships (e.g., "depends on", "blocks", "causes") as edges
- Provides query layer for graph traversal and analysis
"""

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

interface OperationalNode {
    id: string;
    workspaceId: string;
    entityId: string;
    entityType: 'customer' | 'order' | 'shipment' | 'asset' | 'certificate' | 'deal' | 'task' | string;
    properties: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

interface OperationalEdge {
    id: string;
    from: string;
    to: string;
    relationshipType: 'depends_on' | 'blocks' | 'causes' | 'triggers' | 'owns' | 'contains' | string;
    properties: Record<string, unknown>;
    createdAt: Date;
}

class OperationalGraph {
    private nodes: Map<string, OperationalNode>;
    private edges: Map<string, OperationalEdge>;
    private eventEmitter: EventEmitter;

    constructor() {
        this.nodes = new Map();
        this.edges = new Map();
        this.eventEmitter = new EventEmitter();
    }

    addNode(node: Omit<OperationalNode, 'id' | 'createdAt' | 'updatedAt'>): OperationalNode {
        const id = uuidv4();
        const now = new Date();
        const newNode: OperationalNode = { ...node, id, createdAt: now, updatedAt: now };
        this.nodes.set(id, newNode);
        this.eventEmitter.emit('nodeAdded', newNode);
        return newNode;
    }

    updateNode(nodeId: string, properties: Record<string, unknown>): OperationalNode | null {
        const node = this.nodes.get(nodeId);
        if (!node) return null;

        node.properties = { ...node.properties, ...properties };
        node.updatedAt = new Date();
        this.eventEmitter.emit('nodeUpdated', node);
        return node;
    }

    addEdge(edge: Omit<OperationalEdge, 'id' | 'createdAt'>): OperationalEdge {
        const id = uuidv4();
        const now = new Date();
        const newEdge: OperationalEdge = { ...edge, id, createdAt: now };
        this.edges.set(id, newEdge);
        this.eventEmitter.emit('edgeAdded', newEdge);
        return newEdge;
    }

    findRelatedNodes(nodeId: string, relationshipType?: string, direction: 'incoming' | 'outgoing' | 'both' = 'both'): OperationalNode[] {
        const relatedNodes: OperationalNode[] = [];
        const edgeFilter = (edge: OperationalEdge) => {
            if (relationshipType && edge.relationshipType !== relationshipType) return false;
            return direction === 'both' ? (edge.from === nodeId || edge.to === nodeId) :
                   direction === 'incoming' ? edge.to === nodeId : edge.from === nodeId;
        };

        Array.from(this.edges.values())
            .filter(edgeFilter)
            .forEach(edge => {
                const relatedId = edge.from === nodeId ? edge.to : edge.from;
                const node = this.nodes.get(relatedId);
                if (node) relatedNodes.push(node);
            });

        return relatedNodes;
    }

    traverse(startNodeId: string, maxDepth: number = 3): { nodes: OperationalNode[], edges: OperationalEdge[] } {
        const visitedNodes = new Set<string>();
        const visitedEdges = new Set<string>();
        const queue: { nodeId: string, depth: number }[] = [{ nodeId: startNodeId, depth: 0 }];

        while (queue.length > 0) {
            const { nodeId, depth } = queue.shift()!;
            if (depth > maxDepth || visitedNodes.has(nodeId)) continue;
            visitedNodes.add(nodeId);

            const edges = Array.from(this.edges.values()).filter(edge => edge.from === nodeId || edge.to === nodeId);
            edges.forEach(edge => {
                if (!visitedEdges.has(edge.id)) {
                    visitedEdges.add(edge.id);
                    const nextNodeId = edge.from === nodeId ? edge.to : edge.from;
                    queue.push({ nodeId: nextNodeId, depth: depth + 1 });
                }
            });
        }

        return {
            nodes: Array.from(visitedNodes).map(id => this.nodes.get(id)!).filter(Boolean),
            edges: Array.from(visitedEdges).map(id => this.edges.get(id)!).filter(Boolean)
        };
    }

    onNodeAdded(callback: (node: OperationalNode) => void): void {
        this.eventEmitter.on('nodeAdded', callback);
    }

    onNodeUpdated(callback: (node: OperationalNode) => void): void {
        this.eventEmitter.on('nodeUpdated', callback);
    }

    onEdgeAdded(callback: (edge: OperationalEdge) => void): void {
        this.eventEmitter.on('edgeAdded', callback);
    }
}

export { OperationalGraph };
export type { OperationalNode, OperationalEdge };