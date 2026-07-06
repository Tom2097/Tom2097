"""API Endpoints for Autonomous Agents

- Create and manage agents
- Execute actions with scoped permissions
- Retrieve audit trails
"""

import type { NextApiRequest, NextApiResponse } from 'next';
import { AgentSystem } from '../../../lib/intelligence';

const agentSystem = new AgentSystem();

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
    const { agentId, action } = req.query;

    if (agentId && action === 'auditTrail') {
        const auditTrail = agentSystem.getAuditTrail(agentId as string);
        return res.status(200).json(auditTrail);
    }

    return res.status(400).json({ error: 'Invalid query parameters' });
}

function handlePost(req: NextApiRequest, res: NextApiResponse) {
    const { action, agent, agentAction } = req.body;

    if (action === 'createAgent' && agent) {
        const newAgent = agentSystem.createAgent(agent);
        return res.status(201).json(newAgent);
    }

    if (action === 'executeAction' && agentAction) {
        const newAction = agentSystem.executeAction(agentAction.agentId, agentAction);
        return res.status(201).json(newAction);
    }

    return res.status(400).json({ error: 'Invalid action or payload' });
}