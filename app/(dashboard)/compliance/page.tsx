import { ShieldCheck, Activity, FileCheck, AlertTriangle, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { extractTenantContext } from "@/lib/multitenant/context"
import { computeComplianceScore } from "@/lib/compliance/scoring"
import { listCapa } from "@/lib/compliance/capa"
import { runScheduledChecks } from "@/lib/compliance/checks"

export default async function CompliancePage() {
  const ctx = await extractTenantContext()
  const orgId = ctx?.organizationId

  const [score, capas, checks] = orgId
    ? await Promise.all([
        computeComplianceScore(orgId).catch(() => null),
        listCapa(orgId).catch(() => []),
        runScheduledChecks(orgId).catch(() => ({ expired: 0, expiring: 0 })),
      ])
    : [null, [], { expired: 0, expiring: 0 }]

  const openCapas = capas.filter((c) => c.status !== "closed").length
  const overallScore = score?.overall ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20 text-teal-500">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Compliance Workspace</h1>
            <p className="text-sm text-muted-foreground">CAPA, audit trails, compliance scoring, and regulatory checks</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><FileCheck className="h-4 w-4 mr-2" />New CAPA</Button>
          <Button><Activity className="h-4 w-4 mr-2" />Run Audit</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <p className="text-sm text-muted-foreground">Compliance Score</p>
          <p className={`text-3xl font-bold ${overallScore >= 80 ? "text-green-500" : overallScore >= 50 ? "text-amber-500" : "text-red-500"}`}>
            {overallScore}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">Weighted across frameworks</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <p className="text-sm text-muted-foreground">Open CAPAs</p>
          <p className="text-3xl font-bold text-foreground">{openCapas}</p>
          <p className="text-xs text-muted-foreground mt-1">{capas.length} total</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <p className="text-sm text-muted-foreground">Expired Certificates</p>
          <p className={`text-3xl font-bold ${checks.expired > 0 ? "text-red-500" : "text-green-500"}`}>{checks.expired}</p>
          <p className="text-xs text-muted-foreground mt-1">{checks.expiring} expiring soon</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <p className="text-sm text-muted-foreground">Audit Readiness</p>
          <p className="text-3xl font-bold text-foreground">{overallScore >= 70 ? "Ready" : "Needs Work"}</p>
          <p className="text-xs text-muted-foreground mt-1">{score?.by_framework?.length ?? 0} frameworks tracked</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
            <AlertTriangle className="h-5 w-5 text-amber-500" />Open CAPAs
          </h3>
          {openCapas === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">No open CAPAs</div>
          ) : (
            <div className="space-y-3">
              {capas.filter((c) => c.status !== "closed").slice(0, 10).map((capa) => (
                <div key={capa.id} className="flex items-center justify-between rounded-xl bg-secondary/30 p-3">
                  <div>
                    <p className="font-medium text-sm">{capa.title}</p>
                    <p className="text-xs text-muted-foreground">{capa.source} &middot; {capa.severity}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                    capa.status === "open" ? "bg-red-500/10 text-red-500" :
                    capa.status === "investigation" ? "bg-amber-500/10 text-amber-500" :
                    capa.status === "action" ? "bg-blue-500/10 text-blue-500" :
                    "bg-green-500/10 text-green-500"
                  }`}>{capa.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
            <Calendar className="h-5 w-5 text-blue-500" />Score by Framework
          </h3>
          {score?.by_framework && score.by_framework.length > 0 ? (
            <div className="space-y-3">
              {score.by_framework.map((fw, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm">{fw.framework}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${fw.score >= 80 ? "bg-green-500" : fw.score >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${fw.score}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{fw.score}%</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">No framework scores yet</div>
          )}
        </div>
      </div>
    </div>
  )
}
