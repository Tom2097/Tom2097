"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Network,
  Shield,
  Wrench,
  Package,
  FileText,
  DollarSign,
  TrendingUp,
  ChevronRight,
  AlertTriangle,
  ArrowRight,
  CircleDot,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface ChainNode {
  entity: {
    id: string
    name: string
    type: string
    status: string
    module: string
  }
  module: string
  order: number
  monetaryImpact?: number
}

interface CausalLink {
  fromEntity: string
  fromModule: string
  toEntity: string
  toModule: string
  relationship: string
  monetaryImpact?: number
}

interface ChainResult {
  nodes: ChainNode[]
  links: CausalLink[]
  totalMonetaryRisk: number
  primaryCause: ChainNode | null
  affectedDeals: ChainNode[]
}

const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  compliance: Shield,
  resources: Wrench,
  operations: Package,
  crm: DollarSign,
}

const MODULE_COLORS: Record<string, string> = {
  compliance: "border-red-500/50 bg-red-500/5 text-red-500",
  resources: "border-amber-500/50 bg-amber-500/5 text-amber-500",
  operations: "border-purple-500/50 bg-purple-500/5 text-purple-500",
  crm: "border-blue-500/50 bg-blue-500/5 text-blue-500",
}

const TYPE_LABELS: Record<string, string> = {
  certificate: "Certificate",
  instrument: "Instrument",
  asset: "Asset",
  batch: "Batch",
  deal: "Deal",
  document: "Document",
  compliance_gap: "Gap",
  resource: "Resource",
}

export function CausalChainView({ entityId }: { entityId?: string }) {
  const [chain, setChain] = useState<ChainResult | null>(null)
  const [chains, setChains] = useState<ChainResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedChain, setExpandedChain] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"single" | "overview">("overview")

  useEffect(() => {
    const url = entityId
      ? `/api/v1/intelligence/causal-chain?entityId=${entityId}`
      : "/api/v1/intelligence/causal-chain?crossModule=true"
    fetch(url).then((r) => r.ok ? r.json() : null).then((data) => {
      if (data) {
        if (entityId) setChain(data)
        else setChains(data.chains || [])
      }
      setIsLoading(false)
    }).catch(() => setIsLoading(false))
  }, [entityId])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    )
  }

  if (entityId && chain) {
    return <SingleChainView chain={chain} />
  }

  if (chains.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Network className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium">No Causal Chains Found</p>
          <p className="text-sm text-muted-foreground">
            Chains are built as entities are linked across modules. Link entities in the operational graph to see causal paths.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium flex items-center gap-2">
            <Network className="w-4 h-4 text-primary" />
            Cross-Module Causal Chains
          </h3>
          <p className="text-sm text-muted-foreground">
            {chains.length} chains — ${chains.reduce((s, c) => s + c.totalMonetaryRisk, 0).toLocaleString()} total risk
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {chains.map((chain, index) => (
          <motion.div
            key={`chain-${index}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                expandedChain === `chain-${index}` && "ring-1 ring-primary/30",
              )}
              onClick={() => setExpandedChain(expandedChain === `chain-${index}` ? null : `chain-${index}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Chain path visualization */}
                    <div className="flex items-center gap-1 flex-wrap mb-2">
                      {chain.nodes.slice(0, 5).map((node, i) => (
                        <span key={node.entity.id} className="flex items-center gap-1">
                          <Badge
                            variant="outline"
                            className={cn("text-xs", MODULE_COLORS[node.module] || "")}
                          >
                            {node.entity.name.length > 15
                              ? node.entity.name.slice(0, 15) + "..."
                              : node.entity.name}
                          </Badge>
                          {i < chain.nodes.length - 1 && i < 4 && (
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          )}
                        </span>
                      ))}
                      {chain.nodes.length > 5 && (
                        <span className="text-xs text-muted-foreground">+{chain.nodes.length - 5} more</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {chain.nodes.length} entities across {new Set(chain.nodes.map((n) => n.module)).size} modules
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-medium text-red-500">
                        ${chain.totalMonetaryRisk.toLocaleString()} risk
                      </span>
                    </div>

                    {chain.primaryCause && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Primary cause: {chain.primaryCause.entity.name} ({chain.primaryCause.module})
                      </p>
                    )}
                  </div>
                </div>

                {expandedChain === `chain-${index}` && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-4 pt-4 border-t border-border/50"
                  >
                    <ChainVisualization chain={chain} />
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function SingleChainView({ chain }: { chain: ChainResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="w-5 h-5 text-primary" />
          Causal Chain Analysis
        </CardTitle>
        <CardDescription>
          {chain.nodes.length} entities across {new Set(chain.nodes.map((n) => n.module)).size} modules
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChainVisualization chain={chain} />

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-500">${chain.totalMonetaryRisk.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Monetary Risk</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-500">{chain.affectedDeals.length}</p>
              <p className="text-xs text-muted-foreground">Affected Deals</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{chain.nodes.length}</p>
              <p className="text-xs text-muted-foreground">Entities in Chain</p>
            </CardContent>
          </Card>
        </div>

        {chain.affectedDeals.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              Affected Deals
            </h4>
            <div className="space-y-2">
              {chain.affectedDeals.map((deal) => (
                <div
                  key={deal.entity.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50"
                >
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium">{deal.entity.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    ${deal.monetaryImpact?.toLocaleString() || 0}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ChainVisualization({ chain }: { chain: ChainResult }) {
  const modules = Array.from(new Set(chain.nodes.map((n) => n.module)))
  const moduleColors = ["border-red-500", "border-amber-500", "border-purple-500", "border-blue-500"]

  return (
    <div className="space-y-4">
      {/* Module grouping */}
      {modules.map((mod, modIndex) => {
        const moduleNodes = chain.nodes.filter((n) => n.module === mod)
        const totalRisk = moduleNodes.reduce((s, n) => s + (n.monetaryImpact ?? 0), 0)
        return (
          <div key={mod} className={cn("pl-3 border-l-2", moduleColors[modIndex % moduleColors.length])}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = MODULE_ICONS[mod]
                  return Icon ? <Icon className="w-4 h-4 text-muted-foreground" /> : <CircleDot className="w-4 h-4 text-muted-foreground" />
                })()}
                <span className="text-sm font-medium capitalize">{mod}</span>
                <Badge variant="outline" className="text-xs">
                  {moduleNodes.length} entities
                </Badge>
              </div>
              {totalRisk > 0 && (
                <span className="text-xs font-medium">${totalRisk.toLocaleString()}</span>
              )}
            </div>

            <div className="space-y-2 ml-6">
              {moduleNodes.map((node) => (
                <div
                  key={node.entity.id}
                  className="flex items-center justify-between p-2 rounded bg-secondary/20 border border-border/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="text-xs shrink-0">
                      {TYPE_LABELS[node.entity.type] || node.entity.type}
                    </Badge>
                    <span className="text-sm truncate">{node.entity.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        node.entity.status === "active"
                          ? "text-green-500 border-green-500/20"
                          : "text-red-500 border-red-500/20",
                      )}
                    >
                      {node.entity.status}
                    </Badge>
                    {node.monetaryImpact && node.monetaryImpact > 0 && (
                      <span className="text-xs text-muted-foreground">${node.monetaryImpact.toLocaleString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Links summary */}
      {chain.links.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border/50">
          <p className="text-xs font-medium mb-2">Relationships ({chain.links.length})</p>
          <div className="space-y-1">
            {chain.links.slice(0, 5).map((link, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium">{link.fromEntity}</span>
                <ArrowRight className="w-3 h-3" />
                <span className="font-medium">{link.toEntity}</span>
                <span className="text-muted-foreground/60">({link.relationship})</span>
                {link.monetaryImpact && (
                  <span className="text-red-500">${link.monetaryImpact}</span>
                )}
              </div>
            ))}
            {chain.links.length > 5 && (
              <p className="text-xs text-muted-foreground">+{chain.links.length - 5} more relationships</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
