import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import type { CapacityMetric } from "@/lib/platform/capacity-service"
import { cn } from "@/lib/utils"

function statusFor(utilization: number): { label: string; tone: string } {
  if (utilization >= 100) return { label: "At capacity", tone: "bg-destructive/15 text-destructive border-destructive/30" }
  if (utilization >= 80) return { label: "Near limit", tone: "bg-chart-4/15 text-chart-4 border-chart-4/30" }
  return { label: "Healthy", tone: "bg-primary/15 text-primary border-primary/30" }
}

export function CapacityMeter({ metric }: { metric: CapacityMetric }) {
  const status = statusFor(metric.utilization)
  const unit = metric.unit ? ` ${metric.unit}` : ""

  return (
    <Card className="bg-card/80 backdrop-blur-xl border-border/50">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{metric.label}</CardTitle>
        <Badge variant="outline" className={cn("text-xs", status.tone)}>
          {status.label}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums">{metric.used.toLocaleString()}</span>
          <span className="text-sm text-muted-foreground">
            / {metric.limit.toLocaleString()}
            {unit}
          </span>
        </div>
        <Progress value={metric.utilization} className="h-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{metric.utilization}% used</span>
          <span>
            {metric.remaining.toLocaleString()}
            {unit} remaining
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
