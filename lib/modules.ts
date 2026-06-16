import type { Module } from './types'

/**
 * Static navigation config for the platform's configurable workspaces.
 * This is presentation metadata (titles, icons, routes) — not operational
 * data. Live metrics for each surface are fetched from the database.
 */
export const modules: Module[] = [
  {
    id: 'analytics',
    title: 'AI Analytics',
    icon: 'BarChart3',
    description: 'Enterprise intelligence and predictive analytics with AI-powered insights.',
    metrics: ['Revenue Forecasting', 'Risk Analysis', 'Operational Insights', 'Trend Detection'],
    href: '/analytics',
    color: 'chart-1',
  },
  {
    id: 'crm',
    title: 'Smart CRM',
    icon: 'Users',
    description: 'AI-driven customer management, engagement tracking, and sales automation.',
    metrics: ['Lead Tracking', 'Client Intelligence', 'AI Automation', 'Pipeline Management'],
    href: '/crm',
    color: 'chart-2',
  },
  {
    id: 'operations',
    title: 'Operations Workspace',
    icon: 'LayoutGrid',
    description: 'Configurable operational intelligence for any team or business function.',
    metrics: ['Process Monitoring', 'Resource Planning', 'AI Insights', 'Workflow Optimization'],
    href: '/operations',
    color: 'chart-3',
  },
  {
    id: 'performance',
    title: 'Performance Workspace',
    icon: 'Activity',
    description: 'Real-time performance intelligence, anomaly detection, and trend analysis.',
    metrics: ['Anomaly Detection', 'Scoring', 'Signal Tracking', 'Risk Assessment'],
    href: '/performance',
    color: 'chart-4',
  },
  {
    id: 'resources',
    title: 'Resource Workspace',
    icon: 'Boxes',
    description: 'AI-driven resource planning, supply optimization, and capacity forecasting.',
    metrics: ['Demand Forecasting', 'Capacity Analysis', 'Smart Logistics', 'Inventory Intelligence'],
    href: '/resources',
    color: 'chart-5',
  },
  {
    id: 'compliance',
    title: 'Compliance Workspace',
    icon: 'ShieldCheck',
    description: 'Operational compliance, quality control, and audit-readiness analytics.',
    metrics: ['Audit Tracking', 'Quality Control', 'Compliance AI', 'Process Management'],
    href: '/compliance',
    color: 'chart-1',
  },
]
