"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { DollarSign, Shield, Wrench, Package, FileText, AlertTriangle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface GraphNode {
  id: string
  name: string
  type: string
  module: string
  status: string
  monetaryImpact?: number
  x?: number
  y?: number
}

interface GraphEdge {
  from: string
  to: string
  relationship: string
  monetaryImpact?: number
}

interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  totalMonetaryRisk: number
}

const MODULE_COLORS: Record<string, string> = {
  compliance: "#ef4444",
  resources: "#f59e0b",
  operations: "#8b5cf6",
  crm: "#3b82f6",
}

const MODULE_BG: Record<string, string> = {
  compliance: "rgba(239,68,68,0.08)",
  resources: "rgba(245,158,11,0.08)",
  operations: "rgba(139,92,246,0.08)",
  crm: "rgba(59,130,246,0.08)",
}

const TYPE_ICONS: Record<string, string> = {
  certificate: "CERT",
  instrument: "INST",
  asset: "ASST",
  batch: "BCH",
  deal: "DEAL",
  document: "DOC",
  compliance_gap: "GAP",
  resource: "RES",
}

const NODE_WIDTH = 120
const NODE_HEIGHT = 44
const HORIZONTAL_SPACING = 200
const VERTICAL_SPACING = 80

function layoutGraph(nodes: GraphNode[], edges: GraphEdge[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const moduleOrder = ["compliance", "resources", "operations", "crm"]
  const byModule = new Map<string, GraphNode[]>()
  for (const mod of moduleOrder) byModule.set(mod, [])
  for (const node of nodes) {
    const list = byModule.get(node.module)
    if (list) list.push(node)
  }

  const layoutNodes = nodes.map((n) => ({ ...n }))
  const layoutEdges = edges.map((e) => ({ ...e }))

  let x = 80
  for (const mod of moduleOrder) {
    const list = byModule.get(mod) || []
    if (list.length === 0) continue
    const moduleX = x
    const totalHeight = list.length * VERTICAL_SPACING
    let y = Math.max(60, 300 - totalHeight / 2)
    for (const node of list) {
      const layoutNode = layoutNodes.find((n) => n.id === node.id)
      if (layoutNode) {
        layoutNode.x = moduleX
        layoutNode.y = y
      }
      y += VERTICAL_SPACING
    }
    x += HORIZONTAL_SPACING + NODE_WIDTH
  }

  return { nodes: layoutNodes, edges: layoutEdges }
}

export function CausalGraphVisualization({ data }: { data?: GraphData }) {
  const [activeNode, setActiveNode] = useState<string | null>(null)
  const [graph, setGraph] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] })
  const [isLoading, setIsLoading] = useState(!data)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (data) {
      Promise.resolve(data).then((d) => {
        setGraph(layoutGraph(d.nodes, d.edges))
        setIsLoading(false)
      })
      return
    }
    fetch("/api/v1/intelligence/causal-chain?crossModule=true")
      .then((r) => r.ok ? r.json() : null)
      .then((result: unknown) => {
        const data = result as { chains?: { nodes: { entity: { id: string; name: string; type: string; status: string }; module: string; monetaryImpact?: number }[]; links: { fromEntity: string; toEntity: string; relationship: string; monetaryImpact?: number }[] }[] } | null
        if (data?.chains && data.chains.length > 0) {
          const chain = data.chains[0]
          const nodes = chain.nodes.map((n) => ({
            id: n.entity.id,
            name: n.entity.name,
            type: n.entity.type,
            module: n.module,
            status: n.entity.status,
            monetaryImpact: n.monetaryImpact ?? 0,
          }))
          const edges = chain.links.map((l) => ({
            from: l.fromEntity,
            to: l.toEntity,
            relationship: l.relationship,
            monetaryImpact: l.monetaryImpact ?? 0,
          }))
          setGraph(layoutGraph(nodes, edges))
        }
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [data])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-48 bg-secondary/50 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (graph.nodes.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">No graph data available</p>
        </CardContent>
      </Card>
    )
  }

  const svgWidth = Math.max(600, graph.nodes.length * 150 + 200)
  const svgHeight = Math.max(400, Math.max(...graph.nodes.map((n) => n.y || 0)) + 100)

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="font-medium">Cross-Module Causal Graph</h3>
            <Badge variant="outline">
              {graph.nodes.length} entities
            </Badge>
            <Badge variant="outline" className="text-red-500">
              ${graph.edges.reduce((s, e) => s + (e.monetaryImpact || 0), 0).toLocaleString()} risk
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {Object.entries(MODULE_COLORS).map(([mod, color]) => (
              <div key={mod} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="capitalize">{mod}</span>
              </div>
            ))}
          </div>
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto bg-secondary/5 rounded-lg"
          style={{ minHeight: 400 }}
        >
          <defs>
            {Object.entries(MODULE_COLORS).map(([mod, color]) => (
              <marker
                key={mod}
                id={`arrow-${mod}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
              </marker>
            ))}
          </defs>

          {/* Edges */}
          {graph.edges.map((edge, i) => {
            const from = graph.nodes.find((n) => n.id === edge.from)
            const to = graph.nodes.find((n) => n.id === edge.to)
            if (!from?.x || !from?.y || !to?.x || !to?.y) return null

            const x1 = from.x + NODE_WIDTH
            const y1 = from.y + NODE_HEIGHT / 2
            const x2 = to.x
            const y2 = to.y + NODE_HEIGHT / 2
            const midX = (x1 + x2) / 2
            const midY = (y1 + y2) / 2

            return (
              <g key={`edge-${i}`}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={MODULE_COLORS[to.module] || "#666"}
                  strokeWidth={Math.max(1.5, Math.min(4, (edge.monetaryImpact || 0) / 50000))}
                  strokeOpacity={0.5}
                  markerEnd={`url(#arrow-${to.module})`}
                />
                {edge.monetaryImpact && edge.monetaryImpact > 0 && (
                  <text
                    x={midX}
                    y={midY - 8}
                    textAnchor="middle"
                    className="fill-muted-foreground"
                    fontSize="10"
                  >
                    ${edge.monetaryImpact.toLocaleString()}
                  </text>
                )}
                <text
                  x={midX}
                  y={midY + 10}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize="9"
                >
                  {edge.relationship}
                </text>
              </g>
            )
          })}

          {/* Nodes */}
          {graph.nodes.map((node, i) => {
            const x = node.x || 0
            const y = node.y || 0
            const isActive = activeNode === node.id
            const color = MODULE_COLORS[node.module] || "#666"
            const bg = MODULE_BG[node.module] || "rgba(0,0,0,0.05)"

            return (
              <g
                key={`node-${i}`}
                onClick={() => setActiveNode(isActive ? null : node.id)}
                className="cursor-pointer"
              >
                <motion.rect
                  x={x}
                  y={y}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={8}
                  fill={bg}
                  stroke={isActive ? color : `${color}44`}
                  strokeWidth={isActive ? 2 : 1}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                />
                <text
                  x={x + NODE_WIDTH / 2}
                  y={y + NODE_HEIGHT / 2 + 4}
                  textAnchor="middle"
                  className="fill-foreground"
                  fontSize="11"
                  fontWeight="500"
                >
                  {node.name.length > 14 ? node.name.slice(0, 13) + "…" : node.name}
                </text>
                <text
                  x={x + NODE_WIDTH / 2}
                  y={y - 6}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize="9"
                >
                  {TYPE_ICONS[node.type] || node.type}
                </text>
                {node.monetaryImpact && node.monetaryImpact > 0 && (
                  <text
                    x={x + NODE_WIDTH / 2}
                    y={y + NODE_HEIGHT + 12}
                    textAnchor="middle"
                    className="fill-red-500"
                    fontSize="9"
                  >
                    ${node.monetaryImpact.toLocaleString()}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {activeNode && (
          <div className="mt-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
            <p className="text-sm font-medium">
              {graph.nodes.find((n) => n.id === activeNode)?.name}
            </p>
            <p className="text-xs text-muted-foreground">
              Module: {graph.nodes.find((n) => n.id === activeNode)?.module} · Type: {graph.nodes.find((n) => n.id === activeNode)?.type}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
