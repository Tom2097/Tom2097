"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  CreditCard,
  Landmark,
  ArrowRightLeft,
  FileCheck,
  ShieldCheck,
  Wallet,
  Building2,
  BarChart3,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"

interface Payout {
  id: string
  provider: string
  external_id: string
  amount: number
  currency: string
  status: "pending" | "scheduled" | "completed" | "failed"
  arrival_date: string | null
  failure_message: string | null
  metadata: { utr?: string; fees?: number } | null
  created_at: string
}

interface StatusTotal {
  count: number
  amount: number
}

interface PayoutSnapshot {
  funnel: {
    subscriptionsPurchased: number
    transactionsCreated: number
    paymentsVerified: number
    settlements: number
    payouts: number
    bankAccount: number
  }
  statusTotals: {
    pending: StatusTotal
    scheduled: StatusTotal
    completed: StatusTotal
    failed: StatusTotal
  }
  payouts: Payout[]
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(amount)
}

const STATUS_BADGE: Record<Payout["status"], string> = {
  pending: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
  scheduled: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
  completed: "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400",
  failed: "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400",
}

export default function PayoutsPage() {
  const { t } = useI18n()
  const [snapshot, setSnapshot] = useState<PayoutSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const fetchSnapshot = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/platform/payouts")
      const data = await res.json()
      if (res.ok) {
        setSnapshot(data)
      } else {
        toast.error(data.message || t("platformAdmin.payouts.loadFailed"))
      }
    } catch {
      toast.error(t("platformAdmin.payouts.loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [t])

  const handleSync = async () => {
    try {
      setSyncing(true)
      const res = await fetch("/api/platform/payouts", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setSnapshot(data)
        toast.success(t("platformAdmin.payouts.syncSuccess"))
      } else {
        toast.error(data.message || t("platformAdmin.payouts.syncFailed"))
      }
    } catch {
      toast.error(t("platformAdmin.payouts.syncFailed"))
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    const load = async () => {
      await fetchSnapshot()
    }
    load()
  }, [fetchSnapshot])

  const funnelSteps = snapshot
    ? [
        { icon: Users, label: t("platformAdmin.payouts.funnel.customer"), value: null },
        { icon: CreditCard, label: t("platformAdmin.payouts.funnel.subscriptionPurchased"), value: snapshot.funnel.subscriptionsPurchased },
        { icon: Landmark, label: t("platformAdmin.payouts.funnel.paymentGateway"), value: null },
        { icon: ArrowRightLeft, label: t("platformAdmin.payouts.funnel.transactionCreated"), value: snapshot.funnel.transactionsCreated },
        { icon: FileCheck, label: t("platformAdmin.payouts.funnel.paymentVerified"), value: snapshot.funnel.paymentsVerified },
        { icon: ShieldCheck, label: t("platformAdmin.payouts.funnel.settlement"), value: snapshot.funnel.settlements },
        { icon: Wallet, label: t("platformAdmin.payouts.funnel.payout"), value: snapshot.funnel.payouts },
        { icon: Building2, label: t("platformAdmin.payouts.funnel.bankAccount"), value: snapshot.funnel.bankAccount },
        { icon: BarChart3, label: t("platformAdmin.payouts.funnel.revenueDashboard"), value: null },
      ]
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("platformAdmin.payouts.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("platformAdmin.payouts.subtitle")}</p>
        </div>
        <Button onClick={handleSync} disabled={syncing} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? t("platformAdmin.payouts.syncing") : t("platformAdmin.payouts.sync")}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : snapshot ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("platformAdmin.payouts.funnelTitle")}</CardTitle>
              <CardDescription>{t("platformAdmin.payouts.funnelDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-stretch gap-2">
                {funnelSteps.map((step, i) => (
                  <div key={step.label} className="flex items-center gap-2">
                    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border/50 bg-card/50 px-4 py-3 min-w-[8.5rem]">
                      <step.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground text-center">{step.label}</span>
                      {step.value !== null && (
                        <span className="text-lg font-semibold text-foreground tabular-nums">{step.value}</span>
                      )}
                    </div>
                    {i < funnelSteps.length - 1 && (
                      <span className="text-muted-foreground">→</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(["pending", "scheduled", "completed", "failed"] as const).map((status) => (
              <Card key={status}>
                <CardContent className="pt-6">
                  <Badge variant="outline" className={STATUS_BADGE[status]}>
                    {t(`platformAdmin.payouts.status.${status}`)}
                  </Badge>
                  <p className="text-2xl font-bold text-foreground mt-2 tabular-nums">
                    {snapshot.statusTotals[status].count}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatAmount(snapshot.statusTotals[status].amount, "usd")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("platformAdmin.payouts.listTitle")}</CardTitle>
              <CardDescription>{t("platformAdmin.payouts.listDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {snapshot.payouts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {t("platformAdmin.payouts.empty")}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("platformAdmin.payouts.table.provider")}</TableHead>
                      <TableHead>{t("platformAdmin.payouts.table.amount")}</TableHead>
                      <TableHead>{t("platformAdmin.payouts.table.status")}</TableHead>
                      <TableHead>{t("platformAdmin.payouts.table.arrivalDate")}</TableHead>
                      <TableHead>{t("platformAdmin.payouts.table.reference")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshot.payouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell className="font-medium capitalize">{payout.provider}</TableCell>
                        <TableCell className="tabular-nums">{formatAmount(payout.amount, payout.currency)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_BADGE[payout.status]}>
                            {t(`platformAdmin.payouts.status.${payout.status}`)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {payout.arrival_date ? new Date(payout.arrival_date).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {payout.metadata?.utr || payout.external_id}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
