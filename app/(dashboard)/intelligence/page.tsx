"use client"

import { IndustryIntelligenceHub } from "@/components/digit/industry-intelligence-hub"

export default function IntelligencePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Intelligence</h1>
        <p className="text-muted-foreground">
          Real-time insights, benchmarks, and predictions powered by our adaptive AI
        </p>
      </div>
      <IndustryIntelligenceHub />
    </div>
  )
}
