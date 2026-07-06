"""API Endpoints for Causal Graph Operations

- Add events and causal relationships
- Query root causes and downstream effects
- Supports cross-workspace causal reasoning
"""

import type { NextApiRequest, NextApiResponse } from 'next';
import { CausalGraph } from '../../../lib/intelligence';

const causalGraph = new CausalGraph();

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
    const { nodeId, queryType } = req.query;

    if (!nodeId || typeof nodeId !== 'string') {
        return res.status(400).json({ error: 'nodeId is required' });
    }

    if (queryType === 'rootCauses') {
        const rootCauses = causalGraph.findRootCauses(nodeId);
        return res.status(200).json(rootCauses);
    }

    if (queryType === 'downstreamEffects') {
        const downstreamEffects = causalGraph.findDownstreamEffects(nodeId);
        return res.status(200).json(downstreamEffects);
    }

    return res.status(400).json({ error: 'Invalid queryType' });
}

function handlePost(req: NextApiRequest, res: NextApiResponse) {
    const { action, node, edge } = req.body;

    if (action === 'addNode' && node) {
        const newNode = causalGraph.addNode(node);
        return res.status(201).json(newNode);
    }

    if (action === 'addEdge' && edge) {
        const newEdge = causalGraph.addEdge(edge);
        return res.status(201).json(newEdge);
    }

    return res.status(400).json({ error: 'Invalid action or payload' });
}