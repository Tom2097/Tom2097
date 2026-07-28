"use client"

import { useEffect, useState } from "react"
import { Search, Plus, Eye, CheckCircle2, XCircle, AlertTriangle, ArrowRight, Trash2, FlaskConical, Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { useI18n } from "@/components/providers/i18n-provider"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"
import { InView } from "@/components/motion-primitives/in-view"
import type {
  Simulation,
  SimulationChange,
  SimulationDiff,
} from "@/lib/simulation/workspace-simulator"

const STATUS_ICONS: Record<string, typeof FlaskConical> = {
  draft: FlaskConical,
  ready: AlertTriangle,
  committed: CheckCircle2,
  discarded: XCircle,
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-500 border-gray-500/30",
  ready: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  committed: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
  discarded: "bg-red-500/20 text-red-500 border-red-500/30",
}

function getRiskColor(level: string): string {
  switch (level) {
    case "low": return "text-emerald-500"
    case "medium": return "text-amber-500"
    case "high": return "text-red-500"
    default: return "text-muted-foreground"
  }
}

function DiffView({ diff }: { diff: SimulationDiff }) {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      {diff.additions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-emerald-500 mb-2">{t('simulate.page.additions', { count: diff.additions.length })}</h4>
          <div className="space-y-1">
            {diff.additions.map((field, i) => (
              <div key={i} className="rounded bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-sm text-emerald-600">
                + {field}
              </div>
            ))}
          </div>
        </div>
      )}
      {diff.modifications.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-amber-500 mb-2">{t('simulate.page.modifications', { count: diff.modifications.length })}</h4>
          <div className="space-y-1">
            {diff.modifications.map((mod, i) => (
              <div key={i} className="rounded bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-sm">
                <span className="text-amber-600">{mod.field}:</span>{' '}
                <span className="text-muted-foreground line-through">{String(mod.from)}</span>
                {' → '}
                <span className="text-amber-600">{String(mod.to)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {diff.deletions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-red-500 mb-2">{t('simulate.page.deletions', { count: diff.deletions.length })}</h4>
          <div className="space-y-1">
            {diff.deletions.map((field, i) => (
              <div key={i} className="rounded bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-sm text-red-600 line-through">
                - {field}
              </div>
            ))}
          </div>
        </div>
      )}
      <Separator />
      <div className="flex items-center gap-4 text-sm">
        {diff.scoreImpact !== undefined && (
          <span>
            {t('simulate.page.scoreImpact', { impact: `${diff.scoreImpact > 0 ? '+' : ''}${diff.scoreImpact}` })}
          </span>
        )}
        <span className={getRiskColor(diff.riskLevel)}>
          {t('simulate.page.riskLevel', { level: diff.riskLevel })}
        </span>
      </div>
    </div>
  )
}

export default function SimulatePage() {
  const { t } = useI18n()
  const [workspaceId, setWorkspaceId] = useState("workspace-1")
  const [searchInput, setSearchInput] = useState("")
  const [simulations, setSimulations] = useState<Simulation[]>([])
  const [loading, setLoading] = useState(true)
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [diffDialogOpen, setDiffDialogOpen] = useState(false)
  const [selectedDiff, setSelectedDiff] = useState<SimulationDiff | null>(null)
  const [selectedSimId, setSelectedSimId] = useState<string | null>(null)

  const [newField, setNewField] = useState("")
  const [newOldValue, setNewOldValue] = useState("")
  const [newNewValue, setNewNewValue] = useState("")
  const [pendingChanges, setPendingChanges] = useState<SimulationChange[]>([])
  const [submitting, setSubmitting] = useState(false)

  const fetchSimulations = async (wid: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/simulations?workspaceId=${encodeURIComponent(wid)}`)
      const data = await res.json()
      setSimulations(res.ok ? data.simulations ?? [] : [])
    } catch {
      setSimulations([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    fetchSimulations(workspaceId)
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = () => {
    if (searchInput.trim()) {
      const wid = searchInput.trim()
      setWorkspaceId(wid)
      fetchSimulations(wid)
      toast.success(t('simulate.page.success.loaded', { workspaceId: wid }))
    }
  }

  const handleAddChange = () => {
    if (!newField.trim()) return
    setPendingChanges(prev => [...prev, { field: newField.trim(), oldValue: newOldValue, newValue: newNewValue }])
    setNewField("")
    setNewOldValue("")
    setNewNewValue("")
  }

  const handleRemoveChange = (index: number) => {
    setPendingChanges(prev => prev.filter((_, i) => i !== index))
  }

  const handleCreateSimulation = async () => {
    if (pendingChanges.length === 0) {
      toast.error(t('simulate.page.errors.addOneChange'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, changes: pendingChanges }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('simulate.page.errors.createFailed'))
      setSimulations(prev => [data.simulation, ...prev])
      setPendingChanges([])
      setNewDialogOpen(false)
      toast.success(t('simulate.page.success.created'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('simulate.page.errors.createFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleViewDiff = async (simId: string) => {
    try {
      const res = await fetch(`/api/v1/simulations/${simId}/diff`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('simulate.page.errors.compareFailed'))
      setSelectedDiff(data.diff)
      setSelectedSimId(simId)
      setDiffDialogOpen(true)
    } catch (error) {
       toast.error(error instanceof Error ? error.message : t('simulate.page.errors.compareFailed'))
    }
  }

  const handleCommit = async (simId: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/simulations/${simId}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || t('simulate.page.errors.commitFailed'))
      }
      setSimulations(prev => prev.map(s => s.id === simId ? { ...s, status: 'committed' as const, committedAt: new Date().toISOString() } : s))
      toast.success(t('simulate.page.success.committed'))
    } catch (error) {
       toast.error(error instanceof Error ? error.message : t('simulate.page.errors.commitFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDiscard = async (simId: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/simulations/${simId}/discard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || t('simulate.page.errors.discardFailed'))
      }
      setSimulations(prev => prev.map(s => s.id === simId ? { ...s, status: 'discarded' as const } : s))
      toast.success(t('simulate.page.success.discarded'))
    } catch (error) {
       toast.error(error instanceof Error ? error.message : t('simulate.page.errors.discardFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleMarkReady = async (simId: string) => {
    try {
      const res = await fetch(`/api/v1/simulations/${simId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: 'ready' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('simulate.page.errors.markReadyFailed'))
      setSimulations(prev => prev.map(s => s.id === simId ? data.simulation : s))
      toast.success(t('simulate.page.success.markedReady'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('simulate.page.errors.markReadyFailed'))
    }
  }

  return (
    <div className="space-y-6">
      <AnimatedGroup className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-500">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('simulate.page.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('simulate.page.subtitle')}</p>
          </div>
        </div>
      </AnimatedGroup>

      <InView>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('simulate.page.loadWorkspace')}</CardTitle>
          <CardDescription>{t('simulate.page.loadWorkspaceDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder={t('simulate.page.enterWorkspaceId')}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
              className="max-w-md"
            />
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              {t('simulate.page.load')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{t('simulate.page.currentWorkspace', { workspaceId })}</p>
        </CardContent>
      </Card>
      </InView>

      <InView delay={0.08}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('simulate.page.activeSimulations')}</h2>
        <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('simulate.page.newSimulation')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('simulate.page.newSimulation')}</DialogTitle>
              <DialogDescription>{t('simulate.page.newSimulationDesc')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('simulate.page.field')}</Label>
                  <Input placeholder="e.g. budget" value={newField} onChange={e => setNewField(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('simulate.page.oldValue')}</Label>
                  <Input placeholder="current" value={newOldValue} onChange={e => setNewOldValue(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('simulate.page.newValue')}</Label>
                  <Input placeholder="proposed" value={newNewValue} onChange={e => setNewNewValue(e.target.value)} />
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleAddChange} disabled={!newField.trim()}>
                <Plus className="h-3 w-3 mr-1" /> {t('simulate.page.addChange')}
              </Button>
              {pendingChanges.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">{t('simulate.page.pendingChanges', { count: pendingChanges.length })}</p>
                  {pendingChanges.map((change, i) => (
                    <div key={i} className="flex items-center justify-between rounded bg-muted/50 px-3 py-1.5 text-sm">
                      <span><strong>{change.field}</strong>: {String(change.oldValue)} → {String(change.newValue)}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveChange(i)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setNewDialogOpen(false); setPendingChanges([]) }}>{t('simulate.page.close')}</Button>
              <Button onClick={handleCreateSimulation} disabled={pendingChanges.length === 0}>{t('simulate.page.createSimulation')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : simulations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FlaskConical className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-sm text-muted-foreground">{t('simulate.page.noSimulations')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('simulate.page.createHint')}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('simulate.page.id')}</TableHead>
                  <TableHead>{t('simulate.page.changes')}</TableHead>
                  <TableHead>{t('simulate.page.status')}</TableHead>
                  <TableHead>{t('simulate.page.created')}</TableHead>
                  <TableHead>{t('simulate.page.committed')}</TableHead>
                  <TableHead className="text-right">{t('simulate.page.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {simulations.map(sim => {
                  const StatusIcon = STATUS_ICONS[sim.status] || FlaskConical
                  return (
                    <TableRow key={sim.id}>
                      <TableCell className="font-mono text-xs">{sim.id.slice(0, 8)}...</TableCell>
                      <TableCell>{t('simulate.page.changesCount', { count: sim.changes.length })}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[sim.status]}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {sim.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{new Date(sim.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-sm">{sim.committedAt ? new Date(sim.committedAt).toLocaleDateString() : '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleViewDiff(sim.id)}>
                            <Eye className="h-3 w-3 mr-1" /> {t('simulate.page.diff')}
                          </Button>
                          {sim.status === 'draft' && (
                            <>
                              <Button variant="outline" size="sm" onClick={() => handleMarkReady(sim.id)}>
                                <ArrowRight className="h-3 w-3 mr-1" /> {t('simulate.page.ready')}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDiscard(sim.id)}>
                                <XCircle className="h-3 w-3 mr-1" /> {t('simulate.page.discard')}
                              </Button>
                            </>
                          )}
                           {sim.status === 'ready' && (
                             <>
                               <Button variant="default" size="sm" onClick={() => handleCommit(sim.id)} disabled={submitting}>
                                 {submitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                                 <CheckCircle2 className="h-3 w-3 mr-1" /> {t('simulate.page.commit')}
                               </Button>
                               <Button variant="ghost" size="sm" onClick={() => handleDiscard(sim.id)} disabled={submitting}>
                                 {submitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                                 <XCircle className="h-3 w-3 mr-1" /> {t('simulate.page.discard')}
                               </Button>
                             </>
                           )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      </InView>

      <Dialog open={diffDialogOpen} onOpenChange={setDiffDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('simulate.page.simulationDiff')}</DialogTitle>
            <DialogDescription>{t('simulate.page.diffDesc')}</DialogDescription>
          </DialogHeader>
          {selectedDiff ? <DiffView diff={selectedDiff} /> : (
            <p className="text-sm text-muted-foreground">{t('simulate.page.noDiffData')}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiffDialogOpen(false)}>{t('simulate.page.close')}</Button>
            {selectedSimId && (() => {
              const sim = simulations.find(s => s.id === selectedSimId)
              if (!sim || sim.status === 'committed' || sim.status === 'discarded') return null
              return (
                <>
                  {sim.status === 'draft' && (
                    <Button variant="outline" onClick={() => { handleMarkReady(selectedSimId); setDiffDialogOpen(false) }}>
                      <ArrowRight className="h-4 w-4 mr-1" /> {t('simulate.page.ready')}
                    </Button>
                  )}
                   {sim.status === 'ready' && (
                     <Button onClick={() => { handleCommit(selectedSimId); setDiffDialogOpen(false) }} disabled={submitting}>
                       {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                       <CheckCircle2 className="h-4 w-4 mr-1" /> {t('simulate.page.commit')}
                     </Button>
                   )}
                </>
              )
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
