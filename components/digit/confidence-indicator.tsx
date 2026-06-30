"use client"

import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const CONFIDENCE_LABELS: Record<string, string> = {
  auto: "High confidence — executing automatically",
  suggest: "Moderate confidence — recommended for review",
  ask: "Low confidence — awaiting your decision",
  escalate: "Very low confidence — escalated to admin",
}

interface ConfidenceIndicatorProps {
  confidence: number
  className?: string
  showLabel?: boolean
}

export function ConfidenceIndicator({ confidence, className, showLabel }: ConfidenceIndicatorProps) {
  const level = confidence >= 0.8 ? "auto" : confidence >= 0.6 ? "suggest" : confidence >= 0.4 ? "ask" : "escalate"

  const colorMap: Record<string, string> = {
    auto: "bg-green-500",
    suggest: "bg-blue-500",
    ask: "bg-yellow-500",
    escalate: "bg-red-500",
  }

  const bgMap: Record<string, string> = {
    auto: "bg-green-500/20",
    suggest: "bg-blue-500/20",
    ask: "bg-yellow-500/20",
    escalate: "bg-red-500/20",
  }

  const hexMap: Record<string, string> = {
    auto: "#22c55e",
    suggest: "#3b82f6",
    ask: "#eab308",
    escalate: "#ef4444",
  }

  const pct = Math.round(confidence * 100)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("flex items-center gap-2", className)}>
          <div className="flex-1 min-w-[60px]">
            <div className={cn("rounded-full h-1.5", bgMap[level])}>
              <div
                className={cn("rounded-full h-1.5 transition-all duration-500", colorMap[level])}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          {showLabel && (
            <span className="text-xs font-medium" style={{ color: hexMap[level] }}>
              {pct}%
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-[200px]">
        <p>
          {pct}% confidence — {CONFIDENCE_LABELS[level]}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
