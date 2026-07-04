"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Shield, TrendingUp, TrendingDown, Loader2, AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

interface ComplianceDimension {
  name: string
  score: number
  status: string
  trend: "up" | "down" | "stable"
}

interface ComplianceScore {
  overall: number
  status: string
  dimensions: ComplianceDimension[]
  lastAssessment: string
}

export function ComplianceHealthScore() {
  const [score, setScore] = useState<ComplianceScore | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchScore = async () => {
      try {
        const res = await fetch("/api/v1/compliance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "score" }),
        })
        if (res.ok) {
          const data = await res.json()
          setScore(data)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchScore()
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
  if (!score) return null

  return (
    <Card className="p-6 border-border/50 bg-card/50">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Compliance Health</h3>
            <p className="text-xs text-muted-foreground">Last assessed {new Date(score.lastAssessment).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-foreground">{score.overall}%</div>
          <Badge variant={score.status === "healthy" ? "default" : score.status === "at_risk" ? "destructive" : "secondary"}>
            {score.status === "healthy" ? "Healthy" : score.status === "at_risk" ? "At Risk" : "Needs Attention"}
          </Badge>
        </div>
      </div>

      <div className="space-y-4">
        {score.dimensions.map((dim, i) => (
          <motion.div key={dim.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{dim.name}</span>
                {dim.trend === "up" ? <TrendingUp className="w-3 h-3 text-chart-2" /> : dim.trend === "down" ? <TrendingDown className="w-3 h-3 text-destructive" /> : null}
              </div>
              <span className="text-sm font-medium">{dim.score}%</span>
            </div>
            <Progress value={dim.score} className={`h-2 ${dim.score >= 80 ? "bg-chart-2/20" : dim.score >= 60 ? "bg-amber-500/20" : "bg-destructive/20"}`} />
            <div className="flex items-center gap-1 mt-1">
              {dim.score >= 80 ? <CheckCircle2 className="w-3 h-3 text-chart-2" /> : <AlertTriangle className="w-3 h-3 text-amber-500" />}
              <span className="text-xs text-muted-foreground">{dim.status}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 p-3 rounded-lg bg-muted/30 flex items-start gap-2">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
        <p className="text-xs text-muted-foreground">Scores are updated daily based on evidence submissions, audit results, and control tests.</p>
      </div>
    </Card>
  )
}
