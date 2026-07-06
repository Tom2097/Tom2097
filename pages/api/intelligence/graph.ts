"""API Endpoints for Operational Graph Operations

- Add/update nodes and edges
- Query relationships and traversals
- Supports cross-workspace graph operations
"""

import type { NextApiRequest, NextApiResponse } from 'next';
import { OperationalGraph } from '../../../lib/intelligence';

const graph = new OperationalGraph();

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        switch (req.method) {
            case 'GET':
                return handleGet(req, res);
            case 'POST':
                return handlePost(req, res);
            default:
                res.setHeader('Allow', ['GET', 'POST']);
                res.status(405).json({ error: `Method ${req.method} not allowed` });
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
}

function handleGet(req: NextApiRequest, res: NextApiResponse) {
    const { nodeId, relationshipType, direction, maxDepth } = req.query;

    if (nodeId && relationshipType) {
        const nodes = graph.findRelatedNodes(
            nodeId as string,
            relationshipType as string,
            direction as 'incoming' | 'outgoing' | 'both' || 'both'
        );
        return res.status(200).json(nodes);
    }

    if (nodeId && maxDepth) {
        const result = graph.traverse(nodeId as string, Number(maxDepth));
        return res.status(200).json(result);
    }

    return res.status(400).json({ error: 'Invalid query parameters' });
}

function handlePost(req: NextApiRequest, res: NextApiResponse) {
    const { action, node, edge } = req.body;

    if (action === 'addNode' && node) {
        const newNode = graph.addNode(node);
        return res.status(201).json(newNode);
    }

    if (action === 'updateNode' && node?.id) {
        const updatedNode = graph.updateNode(node.id, node.properties);
        return updatedNode ? res.status(200).json(updatedNode) : res.status(404).json({ error: 'Node not found' });
    }

    if (action === 'addEdge' && edge) {
        const newEdge = graph.addEdge(edge);
        return res.status(201).json(newEdge);
    }

    return res.status(400).json({ error: 'Invalid action or payload' });
}