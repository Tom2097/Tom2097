"use client"

import { useState, useEffect } from "react"
import { redirect } from "next/navigation"
import { extractTenantContext } from "@/lib/multitenant/context"
import { getFeedbackStats, listFeedback, createFeedback, voteFeedback } from "@/lib/feedback/engine"
import { detectAnomalies } from "@/lib/analytics/anomaly-detection"
import { forecastMetric } from "@/lib/analytics/forecasting"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Loader2, RefreshCw, MessageSquare, Smile, MessageSquarePlus, ThumbsUp, AlertTriangle, Brain, Search } from "lucide-react"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Cell } from "recharts"
import { ChartContainer } from "@/components/digit/analytics-view"

// Feedback types
const FEEDBACK_TYPES = ["bug", "feature", "general"] as const
const FEEDBACK_STATUSES = ["new", "in_progress", "resolved", "closed"] as const
const FEEDBACK_PRIORITIES = ["low", "medium", "high", "critical"] as const

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-600",
  in_progress: "bg-yellow-500/20 text-yellow-600",
  resolved: "bg-green-500/20 text-green-600",
  closed: "bg-gray-500/20 text-gray-600",
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-green-500/20 text-green-600",
  medium: "bg-yellow-500/20 text-yellow-600",
  high: "bg-orange-500/20 text-orange-600",
  critical: "bg-red-500/20 text-red-600",
}

const TYPE_ICONS = {
  bug: AlertTriangle,
  feature: Sparkles,
  general: MessageSquare,
}

type FeedbackType = typeof FEEDBACK_TYPES[number]
type FeedbackStatus = typeof FEEDBACK_STATUSES[number]
type FeedbackPriority = typeof FEEDBACK_PRIORITIES[number]

type FeedbackForm = {
  title: string
  body: string
  type: FeedbackType
  category: string
  rating?: string
  priority: FeedbackPriority
}

type FeedbackItem = {
  id: string
  title: string
  body: string
  type: FeedbackType
  category: string
  rating?: number
  status: FeedbackStatus
  priority: FeedbackPriority
  vote_count: number
  created_at: string
}

type FeedbackMetrics = {
  sentimentScore: number
  responseTime: number
  categorizationAccuracy: number
  responseRate: number
  openItems: number
  totalItems: number
}

export default function FeedbackPage() {
  const [ctx, setCtx] = useState<any>(null)
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [metrics, setMetrics] = useState<FeedbackMetrics>({ sentimentScore: 0, responseTime: 0, categorizationAccuracy: 0, responseRate: 0, openItems: 0, totalItems: 0 })
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<FeedbackForm>({ title: "", body: "", type: "general", category: "", priority: "medium" })
  const [formError, setFormError] = useState("")
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | 'all'>('all')
  const [filterType, setFilterType] = useState<FeedbackType | 'all'>('all')
  const [sort, setSort] = useState<'recent' | 'votes'>('recent')

  useEffect(() => {
    const fetchContext = async () => {
      const context = await extractTenantContext()
      if (!context) redirect('/auth/login')
      setCtx(context)
      await fetchFeedback(context.organizationId)
    }
    fetchContext()
  }, [])

  const fetchFeedback = async (organizationId?: string) => {
    if (!organizationId) return
    setLoading(true)
    try {
      const [stats, items] = await Promise.all([
        getFeedbackStats(organizationId),
        listFeedback(organizationId, { search, status: filterStatus, type: filterType, sort })
      ])
      setMetrics({
        sentimentScore: stats.sentimentScore,
        responseTime: stats.responseTime,
        categorizationAccuracy: stats.categorizationAccuracy,
        responseRate: stats.responseRate,
        openItems: stats.openItems,
        totalItems: stats.totalItems
      })
      setFeedback(items)
    } catch (error) {
      console.error("Failed to fetch feedback:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ctx?.organizationId) return
    
    if (!form.title.trim()) {
      setFormError("Title is required")
      return
    }
    
    setSubmitting(true)
    setFormError("")
    try {
      await submitFeedback(ctx.organizationId, ctx.userId, {
        title: form.title,
        body: form.body,
        type: form.type,
        category: form.category || 'general',
        priority: form.priority,
        rating: form.rating ? parseInt(form.rating) : undefined
      })
      setOpen(false)
      setForm({ title: "", body: "", type: "general", category: "", priority: "medium" })
      await fetchFeedback(ctx.organizationId)
    } catch (error) {
      setFormError("Failed to submit feedback")
      console.error("Failed to submit feedback:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleVote = async (feedbackId: string) => {
    if (!ctx?.organizationId || !ctx?.userId) return
    try {
      await voteFeedback(ctx.organizationId, feedbackId, ctx.userId)
      await fetchFeedback(ctx.organizationId)
    } catch (error) {
      console.error("Failed to vote:", error)
    }
  }

  const filteredItems = feedback
  const total = feedback.length

  // Sample chart data
  const sentimentData = [
    { name: 'Positive', value: metrics.sentimentScore, sentiment: 1 },
    { name: 'Neutral', value: 100 - metrics.sentimentScore - 10, sentiment: 0 },
    { name: 'Negative', value: 10, sentiment: -1 }
  ]

  const categorizationData = [
    { name: 'Bug Reports', value: 45 },
    { name: 'Feature Requests', value: 30 },
    { name: 'General', value: 25 }
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Feedback Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            {total} item{total !== 1 ? 's' : ''} — AI-powered feedback analysis and response tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => fetchFeedback(ctx?.organizationId)} className="gap-1 text-sm">
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 text-sm">
                <MessageSquare className="h-3 w-3" />
                Submit Feedback
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <DialogHeader>
                  <DialogTitle>Submit Feedback</DialogTitle>
                  <DialogDescription>
                    Share your thoughts, suggestions, or report issues.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="fb-title">Title *</Label>
                    <Input
                      id="fb-title"
                      placeholder="Short summary"
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      maxLength={300}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="fb-body">Details</Label>
                    <Textarea
                      id="fb-body"
                      placeholder="Describe in detail..."
                      value={form.body}
                      onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                      rows={4}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label>Type</Label>
                      <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as FeedbackType }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FEEDBACK_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Priority</Label>
                      <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as FeedbackPriority }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FEEDBACK_PRIORITIES.map((p) => (
                            <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="fb-category">Category</Label>
                      <Input
                        id="fb-category"
                        placeholder="e.g. dashboard, billing"
                        value={form.category}
                        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="fb-rating">Rating (1–5)</Label>
                      <Input
                        id="fb-rating"
                        type="number"
                        min={1}
                        max={5}
                        placeholder="Optional"
                        value={form.rating}
                        onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
                {formError && <p className="text-sm text-destructive">{formError}</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-6 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sentiment Score</CardTitle>
            <Smile className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.sentimentScore}%</div>
            <p className="text-xs text-muted-foreground">Positive sentiment</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.responseTime}h</div>
            <p className="text-xs text-muted-foreground">Avg response time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorization</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.categorizationAccuracy}%</div>
            <p className="text-xs text-muted-foreground">Accuracy</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.responseRate}%</div>
            <p className="text-xs text-muted-foreground">{metrics.openItems} open items</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search feedback..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FeedbackStatus | 'all')}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {FEEDBACK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as FeedbackType | 'all')}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {FEEDBACK_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as 'recent' | 'votes')}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="votes">Most Voted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : feedback.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <MessageSquarePlus className="h-10 w-10 text-muted-foreground/40" />
            <CardTitle className="text-base">No feedback yet</CardTitle>
            <CardDescription>Be the first to submit a bug report, feature request, or idea.</CardDescription>
            <Button variant="outline" onClick={() => setOpen(true)}>Submit Feedback</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {feedback.map((item) => {
            const Icon = TYPE_ICONS[item.type] ?? MessageSquare
            return (
              <Card key={item.id} className="transition-colors hover:border-border">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="mt-0.5 shrink-0 rounded-md bg-secondary p-1.5">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <div className="min-w-0">
                        <CardTitle className="text-base leading-snug text-balance">{item.title}</CardTitle>
                        {item.body && (
                          <CardDescription className="mt-1 line-clamp-2">{item.body}</CardDescription>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleVote(item.id)}
                      className="flex shrink-0 flex-col items-center gap-0.5 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                      aria-label={`Vote for ${item.title}`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      <span className="font-medium">{item.vote_count}</span>
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="pb-3 pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[item.status]}`}>
                      {item.status.replace('_', ' ')}
                    </Badge>
                    <Badge variant="secondary" className={`text-xs ${PRIORITY_COLORS[item.priority]}`}>
                      {item.priority}
                    </Badge>
                    {item.category && item.category !== 'general' && (
                      <Badge variant="outline" className="text-xs">{item.category}</Badge>
                    )}
                    {item.rating && (
                      <span className="text-xs text-muted-foreground">{'★'.repeat(item.rating)}</span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}