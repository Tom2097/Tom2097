"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  Bot,
  Activity,
  Loader2,
  Play,
  Square,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Agent {
  id: string
  name: string
  description: string
  status: "idle" | "running" | "error"
  lastRun: string | null
  findingsResolved: number
  capabilities: string[]
}

const defaultAgents: Agent[] = [
  { id: "compliance-agent", name: "Compliance Guardian", description: "Monitors regulatory gaps and certification renewals", status: "idle", lastRun: null, findingsResolved: 0, capabilities: ["Renew certifications", "Create remediation plans", "Schedule audits"] },
  { id: "resources-agent", name: "Resource Optimizer", description: "Tracks inventory levels and asset utilization", status: "idle", lastRun: null, findingsResolved: 0, capabilities: ["Create purchase orders", "Schedule maintenance", "Reallocate assets"] },
  { id: "crm-agent", name: "Pipeline Protector", description: "Identifies at-risk deals and suggests recovery actions", status: "idle", lastRun: null, findingsResolved: 0, capabilities: ["Send recovery emails", "Assign pipeline owners", "Schedule follow-ups"] },
  { id: "operations-agent", name: "Process Optimizer", description: "Detects operational bottlenecks and quality issues", status: "idle", lastRun: null, findingsResolved: 0, capabilities: ["Adjust production rates", "Schedule quality checks", "Notify stakeholders"] },
]

export function AgentMonitor() {
  const [agents, setAgents] = useState<Agent[]>(defaultAgents)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/v1/intelligence/agents/status")
        if (res.ok) {
          const data = await res.json()
          if (data.agents) setAgents(data.agents)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchStatus()
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleRunAgent = async (agentId: string) => {
    setRunning(agentId)
    try {
      await fetch("/api/v1/intelligence/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      })
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, status: "running" as const } : a))
      setTimeout(() => {
        setAgents(prev => prev.map(a => a.id === agentId ? { ...a, status: "idle" as const, lastRun: new Date().toISOString(), findingsResolved: a.findingsResolved + 1 } : a))
        setRunning(null)
      }, 3000)
    } catch {
      setRunning(null)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Agent Monitor</h3>
          <p className="text-sm text-muted-foreground">AI agents monitoring your workspaces</p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Activity className="w-3 h-3" />
          {agents.filter(a => a.status === "running").length} active
        </Badge>
      </div>

      <div className="grid gap-4">
        {agents.map((agent, i) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="p-4 rounded-lg border border-border/50"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  agent.status === "running" ? "bg-chart-2/20 animate-pulse" : agent.status === "error" ? "bg-destructive/20" : "bg-muted"
                }`}>
                  <Bot className={`w-5 h-5 ${
                    agent.status === "running" ? "text-chart-2" : agent.status === "error" ? "text-destructive" : "text-muted-foreground"
                  }`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{agent.name}</p>
                    <Badge variant={agent.status === "running" ? "default" : agent.status === "error" ? "destructive" : "secondary"} className="text-xs">
                      {agent.status === "running" ? "Running" : agent.status === "error" ? "Error" : "Idle"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{agent.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{agent.findingsResolved} findings resolved</span>
                    {agent.lastRun && <span>Last run: {new Date(agent.lastRun).toLocaleString()}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {agent.capabilities.map((cap) => (
                      <Badge key={cap} variant="outline" className="text-xs">{cap}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant={agent.status === "running" ? "outline" : "default"} onClick={() => handleRunAgent(agent.id)} disabled={running === agent.id || agent.status === "running"}>
                  {running === agent.id ? <Loader2 className="w-4 h-4 animate-spin" /> : agent.status === "running" ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {agent.status === "running" ? "Running..." : "Run"}
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
