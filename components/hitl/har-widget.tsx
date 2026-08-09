"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ClipboardCheck, ArrowRight } from "lucide-react"
import { useI18n } from "@/components/providers/i18n-provider"

interface HumanActionRequest {
  id: string
  reason: string
  priority: "low" | "normal" | "high" | "urgent"
}

/** Dashboard widget (spec section 5: "the first thing seen at login --
 *  highest-value surface"). Self-fetching so it doesn't add another
 *  server-side query to the dashboard page's existing Promise.all
 *  waterfall. */
export function HarWidget() {
  const { t } = useI18n()
  const [requests, setRequests] = useState<HumanActionRequest[] | null>(null)

  useEffect(() => {
    fetch("/api/v1/hitl/requests")
      .then((res) => (res.ok ? res.json() : { requests: [] }))
      .then((data) => setRequests(data.requests || []))
      .catch(() => setRequests([]))
  }, [])

  if (requests === null || requests.length === 0) return null

  return (
    <Card className="p-4 border-amber-500/30 bg-amber-500/5">
      <Link href="/approvals" className="flex items-center justify-between gap-4 group">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              {t("dashboard.harWidget.waiting", { count: String(requests.length) })}
            </p>
            <p className="text-sm text-muted-foreground truncate max-w-md">{requests[0].reason}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
            {t("dashboard.harWidget.review")}
          </Badge>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>
    </Card>
  )
}
