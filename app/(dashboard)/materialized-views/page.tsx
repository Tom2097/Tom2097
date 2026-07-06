'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Database,
  RefreshCw,
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Trash2,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MaterializedView {
  name: string
  query: string
  lastRefreshed: string | null
  rowCount: number
  status: 'stale' | 'refreshing' | 'fresh'
  refreshInterval: number
}

interface ScoringCache {
  workspaceId: string
  totalScore: number
  categoryScores: Record<string, number>
  benchmarks: { percentile: number; peerAvg: number } | null
  lastCalculated: string
  stale: boolean
}

const STATUS_COLORS: Record<string, string> = {
  stale: 'bg-amber-500/10 text-amber-500',
  refreshing: 'bg-blue-500/10 text-blue-500',
  fresh: 'bg-green-500/10 text-green-500',
}

export default function MaterializedViewsPage() {
  const [views, setViews] = useState<MaterializedView[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingViews, setRefreshingViews] = useState<Set<string>>(new Set())
  const [refreshingAll, setRefreshingAll] = useState(false)

  const [workspaceId, setWorkspaceId] = useState('')
  const [cache, setCache] = useState<ScoringCache | null>(null)
  const [cacheLoading, setCacheLoading] = useState(false)
  const [cacheDialogOpen, setCacheDialogOpen] = useState(false)
  const [queryWorkspace, setQueryWorkspace] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/v1/analytics/views')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => { if (!cancelled) setViews(data.views ?? []) })
      .catch(() => { if (!cancelled) toast.error('Failed to load materialized views') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleRefreshView = async (name: string) => {
    setRefreshingViews((prev) => new Set(prev).add(name))
    try {
      const res = await fetch('/api/v1/analytics/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Refresh failed'); return }
      toast.success(`View "${name}" refreshed: ${data.result.rowsInserted} rows in ${data.result.durationMs}ms`)
      const refresh = await fetch('/api/v1/analytics/views')
      const refData = await refresh.json()
      if (refData.views) setViews(refData.views)
    } catch {
      toast.error('Failed to refresh view')
    } finally {
      setRefreshingViews((prev) => {
        const next = new Set(prev)
        next.delete(name)
        return next
      })
    }
  }

  const handleRefreshAll = async () => {
    setRefreshingAll(true)
    try {
      const res = await fetch('/api/v1/analytics/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'all' }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Refresh failed'); return }
      toast.success(`All views refreshed (${data.results.length} total)`)
      const refresh = await fetch('/api/v1/analytics/views')
      const refData = await refresh.json()
      if (refData.views) setViews(refData.views)
    } catch {
      toast.error('Failed to refresh all views')
    } finally {
      setRefreshingAll(false)
    }
  }

  const handleQueryCache = async () => {
    if (!queryWorkspace.trim()) {
      toast.error('Please enter a workspace ID')
      return
    }
    setCacheLoading(true)
    setWorkspaceId(queryWorkspace)
    try {
      const res = await fetch(`/api/v1/analytics/views/cache?workspaceId=${encodeURIComponent(queryWorkspace)}`)
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to load cache'); return }
      setCache(data.cache)
      setCacheDialogOpen(true)
    } catch {
      toast.error('Failed to load scoring cache')
    } finally {
      setCacheLoading(false)
    }
  }

  const handleInvalidateCache = async () => {
    if (!workspaceId) return
    try {
      const res = await fetch(`/api/v1/analytics/views/cache?workspaceId=${encodeURIComponent(workspaceId)}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to invalidate'); return }
      toast.success(data.message ?? 'Cache invalidated')
      if (cache) setCache({ ...cache, stale: true })
    } catch {
      toast.error('Failed to invalidate cache')
    }
  }

  const formatInterval = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const freshCount = views.filter((v) => v.status === 'fresh').length
  const staleCount = views.filter((v) => v.status === 'stale').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-500">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Materialized Views</h1>
            <p className="text-sm text-muted-foreground">Database-level scoring cache and view management</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleRefreshAll}
          disabled={refreshingAll}
        >
          <RefreshCw className={cn('h-4 w-4', refreshingAll && 'animate-spin')} />
          {refreshingAll ? 'Refreshing...' : 'Refresh All'}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Layers className="h-5 w-5 text-cyan-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Views</p>
                <p className="text-2xl font-bold text-foreground">{views.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Fresh</p>
                <p className="text-2xl font-bold text-green-500">{freshCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Stale</p>
                <p className="text-2xl font-bold text-amber-500">{staleCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-indigo-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Rows</p>
                <p className="text-2xl font-bold text-foreground">
                  {views.reduce((s, v) => s + v.rowCount, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5 text-cyan-500" />
            View Definitions
          </CardTitle>
          <CardDescription>Materialized view status, row counts, and refresh controls</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>View Name</TableHead>
                <TableHead>Row Count</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Refresh Interval</TableHead>
                <TableHead>Last Refreshed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {views.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    No materialized views defined
                  </TableCell>
                </TableRow>
              ) : (
                views.map((view) => (
                  <TableRow key={view.name}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm font-medium">{view.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{view.rowCount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-xs capitalize',
                          STATUS_COLORS[view.status],
                          view.status === 'refreshing' && 'animate-pulse'
                        )}
                      >
                        {view.status === 'refreshing' && (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        )}
                        {view.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatInterval(view.refreshInterval)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {view.lastRefreshed
                        ? new Date(view.lastRefreshed).toLocaleString()
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleRefreshView(view.name)}
                        disabled={refreshingViews.has(view.name) || view.status === 'refreshing'}
                      >
                        <RefreshCw
                          className={cn(
                            'h-3.5 w-3.5',
                            refreshingViews.has(view.name) && 'animate-spin'
                          )}
                        />
                        {refreshingViews.has(view.name) ? 'Refreshing' : 'Refresh'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-indigo-500" />
            Scoring Cache
          </CardTitle>
          <CardDescription>Look up and manage cached scoring data by workspace</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label htmlFor="workspace-id">Workspace ID</Label>
              <Input
                id="workspace-id"
                placeholder="e.g. ws_abc123"
                value={queryWorkspace}
                onChange={(e) => setQueryWorkspace(e.target.value)}
              />
            </div>
            <Button
              className="gap-2"
              onClick={handleQueryCache}
              disabled={cacheLoading}
            >
              {cacheLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Look Up
            </Button>
          </div>

          {queryWorkspace && !cacheLoading && (
            <p className="mt-2 text-xs text-muted-foreground">
              Enter a workspace ID and click &ldquo;Look Up&rdquo; to view cached scoring data
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={cacheDialogOpen} onOpenChange={setCacheDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-500" />
              Scoring Cache: {workspaceId}
            </DialogTitle>
          </DialogHeader>
          {cache && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2">
                <Label className="text-muted-foreground text-xs">Status</Label>
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-xs',
                    cache.stale
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'bg-green-500/10 text-green-500'
                  )}
                >
                  {cache.stale ? 'Stale' : 'Fresh'}
                </Badge>
              </div>

              <div className="rounded-lg bg-secondary/30 p-4">
                <p className="text-sm text-muted-foreground">Total Score</p>
                <p className="text-3xl font-bold text-foreground">{cache.totalScore}</p>
              </div>

              <div>
                <Label className="text-muted-foreground text-xs mb-2 block">
                  Category Scores
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(cache.categoryScores).map(([key, val]) => (
                    <div key={key} className="rounded-lg bg-secondary/20 p-3">
                      <p className="text-xs text-muted-foreground capitalize">{key}</p>
                      <p className="text-lg font-semibold text-foreground">{val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {cache.benchmarks && (
                <div>
                  <Label className="text-muted-foreground text-xs mb-2 block">
                    Benchmarks
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-secondary/20 p-3">
                      <p className="text-xs text-muted-foreground">Percentile</p>
                      <p className="text-lg font-semibold text-foreground">
                        {cache.benchmarks.percentile}th
                      </p>
                    </div>
                    <div className="rounded-lg bg-secondary/20 p-3">
                      <p className="text-xs text-muted-foreground">Peer Average</p>
                      <p className="text-lg font-semibold text-foreground">
                        {cache.benchmarks.peerAvg}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Last calculated: {new Date(cache.lastCalculated).toLocaleString()}
              </p>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleInvalidateCache}
                >
                  <Trash2 className="h-4 w-4" />
                  Invalidate Cache
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCacheDialogOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
