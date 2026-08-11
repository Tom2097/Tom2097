"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Globe2, Users, Eye, Clock } from "lucide-react"
import { toast } from "sonner"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"

interface SiteVisit {
  id: string
  path: string
  referrer: string | null
  country: string | null
  country_code: string | null
  city: string | null
  region_name: string | null
  device_type: string | null
  session_id: string
  created_at: string
}

interface VisitorSnapshot {
  totalVisits: number
  uniqueVisitors: number
  last24h: number
  topCountries: { country: string; country_code: string | null; visits: number }[]
  topPages: { path: string; visits: number }[]
  recentVisits: SiteVisit[]
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function VisitorsPage() {
  const { t } = useI18n()
  const [snapshot, setSnapshot] = useState<VisitorSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSnapshot = useCallback(async (cancelled?: { current: boolean }) => {
    try {
      if (!cancelled?.current) setLoading(true)
      const res = await fetch("/api/platform/visitors")
      const data = await res.json()
      if (cancelled?.current) return
      if (res.ok) {
        setSnapshot(data)
      } else {
        toast.error(data.message || t("platformAdmin.visitors.loadFailed"))
      }
    } catch {
      if (!cancelled?.current) toast.error(t("platformAdmin.visitors.loadFailed"))
    } finally {
      if (!cancelled?.current) setLoading(false)
    }
  }, [t])

  useEffect(() => {
    const cancelled = { current: false }
    const load = async () => {
      await fetchSnapshot(cancelled)
    }
    load()
    return () => { cancelled.current = true }
  }, [fetchSnapshot])

  const maxCountryVisits = snapshot?.topCountries[0]?.visits ?? 1

  return (
    <div className="space-y-6">
      <AnimatedGroup>
        <h1 className="text-2xl font-bold text-foreground">{t("platformAdmin.visitors.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("platformAdmin.visitors.subtitle")}</p>
      </AnimatedGroup>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : snapshot ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("platformAdmin.visitors.totalVisits")}</p>
                  <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{snapshot.totalVisits}</p>
                </div>
                <Eye className="h-4 w-4 text-muted-foreground mt-1" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("platformAdmin.visitors.uniqueVisitors")}</p>
                  <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{snapshot.uniqueVisitors}</p>
                </div>
                <Users className="h-4 w-4 text-muted-foreground mt-1" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("platformAdmin.visitors.last24h")}</p>
                  <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{snapshot.last24h}</p>
                </div>
                <Clock className="h-4 w-4 text-muted-foreground mt-1" />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe2 className="h-4 w-4" />
                  {t("platformAdmin.visitors.byCountry")}
                </CardTitle>
                <CardDescription>{t("platformAdmin.visitors.byCountryDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                {snapshot.topCountries.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">{t("platformAdmin.visitors.empty")}</p>
                ) : (
                  <div className="space-y-3">
                    {snapshot.topCountries.map((c) => (
                      <div key={c.country} className="flex items-center gap-3">
                        <span className="text-sm text-foreground w-28 truncate shrink-0">{c.country}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-chart-1"
                            style={{ width: `${Math.max(4, (c.visits / maxCountryVisits) * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground tabular-nums w-8 text-right shrink-0">{c.visits}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("platformAdmin.visitors.topPages")}</CardTitle>
                <CardDescription>{t("platformAdmin.visitors.topPagesDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                {snapshot.topPages.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">{t("platformAdmin.visitors.empty")}</p>
                ) : (
                  <div className="space-y-2">
                    {snapshot.topPages.map((p) => (
                      <div key={p.path} className="flex items-center justify-between text-sm">
                        <span className="text-foreground truncate">{p.path}</span>
                        <span className="text-muted-foreground tabular-nums shrink-0 ml-2">{p.visits}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("platformAdmin.visitors.recentTitle")}</CardTitle>
              <CardDescription>{t("platformAdmin.visitors.recentDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {snapshot.recentVisits.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">{t("platformAdmin.visitors.empty")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("platformAdmin.visitors.table.when")}</TableHead>
                      <TableHead>{t("platformAdmin.visitors.table.page")}</TableHead>
                      <TableHead>{t("platformAdmin.visitors.table.location")}</TableHead>
                      <TableHead>{t("platformAdmin.visitors.table.referrer")}</TableHead>
                      <TableHead>{t("platformAdmin.visitors.table.device")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshot.recentVisits.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(v.created_at)}</TableCell>
                        <TableCell className="font-medium">{v.path}</TableCell>
                        <TableCell className="text-sm">
                          {v.city ? `${v.city}, ${v.country}` : v.country || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[12rem]">
                          {v.referrer || t("platformAdmin.visitors.direct")}
                        </TableCell>
                        <TableCell>
                          {v.device_type && (
                            <Badge variant="outline" className="capitalize">{v.device_type}</Badge>
                          )}
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
