"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Mail, Send, UserPlus, Building2, ClipboardCheck, Loader2, CheckCircle2, ArrowRight, Sparkles, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

const workflowSteps = [
  { id: "1", title: "Create Tenant Environment", description: "Provision dedicated workspace and database", status: "pending" },
  { id: "2", title: "Send Welcome Email", description: "Onboarding instructions with account credentials", status: "pending" },
  { id: "3", title: "Assign Account Manager", description: "Auto-assign from available pool", status: "pending" },
  { id: "4", title: "Schedule Kickoff Call", description: "Calendar link sent to customer within 24h", status: "pending" },
  { id: "5", title: "Create Implementation Plan", description: "Generate milestone-based onboarding plan", status: "pending" },
  { id: "6", title: "Provision Integrations", description: "Configure API keys and webhook endpoints", status: "pending" },
]

export function CrmAutoProvision() {
  const [dealUrl, setDealUrl] = useState("")
  const [running, setRunning] = useState(false)
  const [completed, setCompleted] = useState<string[]>([])
  const [activeStep, setActiveStep] = useState<string | null>(null)

  const simulateProvision = async () => {
    if (!dealUrl.trim()) return
    setRunning(true)
    setCompleted([])

    for (const step of workflowSteps) {
      setActiveStep(step.id)
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 400))
      setCompleted((prev) => [...prev, step.id])
    }

    setActiveStep(null)
    setRunning(false)
    setDealUrl("")
  }

  return (
    <Card className="border-green-500/20">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <UserPlus className="h-4 w-4 text-green-500" />
          Auto-Provision on Won
          <Badge className="text-[10px]" variant="secondary">Automation</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Paste deal URL or ID to provision..."
            value={dealUrl}
            onChange={(e) => setDealUrl(e.target.value)}
            className="text-sm flex-1"
            disabled={running}
          />
          <Button onClick={simulateProvision} disabled={running || !dealUrl.trim()}>
            {running ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
            {running ? "Provisioning..." : "Start"}
          </Button>
        </div>

        <div className="space-y-1.5">
          {workflowSteps.map((step) => {
            const isDone = completed.includes(step.id)
            const isActive = activeStep === step.id
            return (
              <motion.div
                key={step.id}
                animate={{ opacity: 1 }}
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${isActive ? "bg-primary/10 border border-primary/20" : isDone ? "bg-green-500/5" : ""}`}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                  isDone ? "bg-green-500" : isActive ? "bg-primary animate-pulse" : "bg-muted-foreground/20"
                )}>
                  {isDone ? <CheckCircle2 className="h-3.5 w-3.5 text-white" /> : <span className="text-[10px] font-bold text-foreground">{step.id}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{step.title}</p>
                  <p className="text-[10px] text-muted-foreground">{step.description}</p>
                </div>
                {isActive && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                {isDone && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
              </motion.div>
            )
          })}
        </div>

        {completed.length === workflowSteps.length && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-green-500/10 border border-green-500/20"
          >
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-medium">Provisioning Complete</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">All 6 onboarding steps completed. Customer is ready to go.</p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}
