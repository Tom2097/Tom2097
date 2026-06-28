"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IntelligenceCommandCenter } from "@/components/digit/intelligence-command-center"
import { IndustryIntelligenceHub } from "@/components/digit/industry-intelligence-hub"
import { CausalChainView } from "@/components/digit/causal-chain-view"
import { Brain, BarChart3, Network, Sparkles } from "lucide-react"

export default function IntelligencePage() {
  const [activeTab, setActiveTab] = useState("command-center")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Intelligence</h1>
          <p className="text-muted-foreground">
            Real-time monitoring, causal reasoning, and autonomous agents
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="command-center" className="gap-2">
            <Brain className="w-4 h-4" />
            Command Center
          </TabsTrigger>
          <TabsTrigger value="industry" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Industry Hub
          </TabsTrigger>
          <TabsTrigger value="causal-chains" className="gap-2">
            <Network className="w-4 h-4" />
            Causal Chains
          </TabsTrigger>
        </TabsList>

        <TabsContent value="command-center" className="mt-4">
          <IntelligenceCommandCenter />
        </TabsContent>

        <TabsContent value="industry" className="mt-4">
          <IndustryIntelligenceHub />
        </TabsContent>

        <TabsContent value="causal-chains" className="mt-4">
          <CausalChainView />
        </TabsContent>
      </Tabs>
    </div>
  )
}
