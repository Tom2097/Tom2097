"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Users, Building2, DollarSign, ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"

const verticals = [
  { name: "Manufacturing", deals: 12, value: 480000, growth: 23, signals: ["IIoT adoption surge", "Supply chain digitization", "Quality compliance mandates"], trend: "up" as const },
  { name: "Healthcare", deals: 8, value: 320000, growth: 15, signals: ["HIPAA audit season", "Telehealth expansion", "AI diagnostics adoption"], trend: "up" as const },
  { name: "Finance", deals: 6, value: 520000, growth: -5, signals: ["Regulatory tightening", "Fintech competition", "Open banking requirements"], trend: "down" as const },
  { name: "Technology", deals: 15, value: 680000, growth: 31, signals: ["AI/ML investment boom", "Remote workforce tools", "Cybersecurity spending up"], trend: "up" as const },
  { name: "Energy", deals: 4, value: 195000, growth: 8, signals: ["Green energy subsidies", "Grid modernization", "Carbon reporting mandates"], trend: "up" as const },
]

export function CrmVerticalSignals() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          <p className="text-sm font-medium">Vertical Buying Signals</p>
        </div>
        <Badge variant="secondary" className="text-[10px]">Market intelligence</Badge>
      </div>

      <div className="space-y-2">
        {verticals.map((v, i) => (
          <motion.div key={v.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
            className="p-3 rounded-xl border border-border/50 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">{v.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">${v.value.toLocaleString()}</span>
                <div className={cn("flex items-center gap-0.5 text-xs font-medium", v.trend === "up" ? "text-green-500" : "text-red-500")}>
                  {v.trend === "up" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {Math.abs(v.growth)}%
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{v.deals} deals</span>
              <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />${(v.value / v.deals / 1000).toFixed(0)}K avg</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {v.signals.map((s) => (
                <Badge key={s} variant="secondary" className="text-[10px]">
                  {s}
                </Badge>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
