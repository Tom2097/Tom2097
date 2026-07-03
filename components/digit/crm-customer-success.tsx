"use client"

import { useState, useEffect } from "react"
import { Heart, TrendingUp, AlertTriangle, CheckCircle2, Calendar, ArrowUp, Users } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Account {
  id: string
  company: string
  health: "healthy" | "at_risk" | "churned"
  score: number
  renewal: string | null
  plan: string
  lastActivity: string
}

const healthStyles: Record<string, string> = {
  healthy: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  at_risk: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  churned: "bg-red-500/10 text-red-500 border-red-500/20",
}

const healthIcons: Record<string, React.ElementType> = {
  healthy: CheckCircle2,
  at_risk: AlertTriangle,
  churned: AlertTriangle,
}

export function CrmCustomerSuccess() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<string>("all")

  useEffect(() => {
    fetch("/api/v1/crm/customer-success")
      .then((r) => r.ok ? r.json() : Promise.reject("Failed"))
      .then((data) => {
        const items = (data.accounts || data.data || []).map((a: unknown) => {
          const account = a as { id: string; name: string; health: string; value: number; };
          return {
          id: account.id,
          company: account.company || account.name || "",
          health: account.health || account.health_status || "healthy",
          score: account.score || account.health_score || 0,
          renewal: account.renewal || account.renewal_date || null,
          plan: account.plan || account.plan_name || "",
          lastActivity: account.last_activity || account.lastActivity || "",
        };
      })
        setAccounts(items)
        setLoading(false)
      })
      .catch(() => { setError("Failed to load accounts"); setLoading(false) })
  }, [])

  const filtered = filter === "all" ? accounts : accounts.filter((a) => a.health === filter)
  const healthy = accounts.filter((a) => a.health === "healthy").length
  const atRisk = accounts.filter((a) => a.health === "at_risk").length
  const avgScore = accounts.length ? Math.round(accounts.reduce((s, a) => s + a.score, 0) / accounts.length) : 0

  if (loading) return <div className="text-xs text-muted-foreground p-4 text-center">Loading accounts...</div>
  if (error) return <div className="text-xs text-red-500 p-4 text-center">{error}</div>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <Card className="p-3 border-border/50">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Accounts</p>
          <p className="text-xl font-bold text-foreground mt-1">{accounts.length}</p>
        </Card>
        <Card className="p-3 border-border/50">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Healthy</p>
          <p className="text-xl font-bold text-emerald-500 mt-1">{healthy}</p>
        </Card>
        <Card className="p-3 border-border/50">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">At Risk</p>
          <p className="text-xl font-bold text-amber-500 mt-1">{atRisk}</p>
        </Card>
        <Card className="p-3 border-border/50">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Health Score</p>
          <p className="text-xl font-bold text-foreground mt-1">{avgScore}%</p>
        </Card>
      </div>

      <div className="flex gap-1 rounded-lg border border-border/50 p-0.5 bg-secondary/30 w-fit">
        {["all", "healthy", "at_risk", "churned"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn("px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors", filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
          >
            {f === "at_risk" ? "At Risk" : f}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((account) => {
          const HealthIcon = healthIcons[account.health]
          return (
            <Card key={account.id} className="p-4 border-border/50 hover:border-primary/30 transition-all cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", healthStyles[account.health])}>
                    <HealthIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground text-sm">{account.company}</p>
                      <Badge className={cn("text-[10px] px-1.5 h-4 capitalize font-normal border", healthStyles[account.health])}>{account.health}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{account.plan} plan</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Heart className="w-3 h-3" />Score: {account.score}%</span>
                      {account.renewal && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Renewal: {new Date(account.renewal).toLocaleDateString()}</span>}
                      <span>Last activity: {account.lastActivity}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <TrendingUp className="w-3 h-3" />
                    {account.score >= 80 ? "Upsell opportunity" : account.score >= 40 ? "Needs attention" : "At risk of churn"}
                  </Badge>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}