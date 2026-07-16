"use client"

import { useState, useEffect, useCallback } from "react"
import { useI18n } from "@/components/providers/i18n-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Loader2, RefreshCw, MessageSquare, Smile, MessageSquarePlus, ThumbsUp, AlertTriangle, Brain, Search, Sparkles } from "lucide-react"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Cell } from "recharts"
import { ChartContainer } from "@/components/digit/live-chart"

// Feedback types -- must match lib/feedback/types.ts's real enums (and the
// feedback table's CHECK constraints); a mismatch here means submissions
// with the "wrong" value get silently rejected by the database.
const FEEDBACK_TYPES = ["bug", "feature", "improvement", "question", "general"] as const
const FEEDBACK_STATUSES = ["open", "triaged", "in_progress", "resolved", "closed", "wont_fix"] as const
const FEEDBACK_PRIORITIES = ["low", "normal", "high", "urgent"] as const

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/20 text-blue-600",
  triaged: "bg-indigo-500/20 text-indigo-600",
  in_progress: "bg-yellow-500/20 text-yellow-600",
  resolved: "bg-green-500/20 text-green-600",
  closed: "bg-gray-500/20 text-gray-600",
  wont_fix: "bg-gray-500/20 text-gray-600",
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-green-500/20 text-green-600",
  normal: "bg-yellow-500/20 text-yellow-600",
  high: "bg-orange-500/20 text-orange-600",
  urgent: "bg-red-500/20 text-red-600",
}

const TYPE_ICONS = {
  bug: AlertTriangle,
  feature: Sparkles,
  improvement: Sparkles,
  question: MessageSquare,
  general: MessageSquare,
}

function toI18nKey(value: string): string {
  return value.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
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
  categorizationRate: number
  responseRate: number
  openItems: number
  totalItems: number
}

export default function FeedbackPage() {
  const { t } = useI18n()
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [metrics, setMetrics] = useState<FeedbackMetrics>({ sentimentScore: 0, responseTime: 0, categorizationRate: 0, responseRate: 0, openItems: 0, totalItems: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<FeedbackForm>({ title: "", body: "", type: "general", category: "", priority: "normal" })
  const [formError, setFormError] = useState("")
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | 'all'>('all')
  const [filterType, setFilterType] = useState<FeedbackType | 'all'>('all')
  const [sort, setSort] = useState<'recent' | 'votes'>('recent')

  const fetchFeedback = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (filterType !== 'all') params.set('type', filterType)
      if (sort) params.set('sort', sort)
      
      const response = await fetch(`/api/v1/feedback?${params.toString()}`)
      if (!response.ok) {
        if (response.status === 401) {
          setError("Please sign in to view feedback.")
        } else {
          setError("Failed to load feedback.")
        }
        setFeedback([])
        return
      }
      
      const { stats, items } = await response.json()
      
      setMetrics({
        sentimentScore: stats.sentimentScore,
        responseTime: stats.responseTime,
        categorizationRate: stats.categorizationRate,
        responseRate: stats.responseRate,
        openItems: stats.openItems,
        totalItems: stats.totalItems
      })
      setFeedback(items)
    } catch (error) {
      console.error("Failed to fetch feedback:", error)
      setError("Failed to load feedback.")
    } finally {
      setLoading(false)
    }
  }, [search, filterStatus, filterType, sort])

  // Debounced fetch on mount and when filters/sort/search change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFeedback()
    }, 300)
    return () => clearTimeout(timer)
  }, [search, filterStatus, filterType, sort, fetchFeedback])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!form.title.trim()) {
      setFormError(t("feedback.page.requiredField"))
      return
    }
    
    setSubmitting(true)
    setFormError("")
    try {
      const response = await fetch('/api/v1/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          body: form.body,
          type: form.type,
          category: form.category || 'general',
          priority: form.priority,
          rating: form.rating ? parseInt(form.rating) : undefined
        })
      })
      
      if (!response.ok) throw new Error('Failed to submit feedback')
      
      setOpen(false)
      setForm({ title: "", body: "", type: "general", category: "", priority: "normal" })
      await fetchFeedback()
    } catch (error) {
      setFormError("Failed to submit feedback")
      console.error("Failed to submit feedback:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleVote = async (feedbackId: string) => {
    try {
      const response = await fetch('/api/v1/feedback/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackId })
      })
      
      if (!response.ok) throw new Error('Failed to vote')
      
      await fetchFeedback()
    } catch (error) {
      console.error("Failed to vote:", error)
    }
  }

  const filteredItems = feedback
  const total = feedback.length

  // Sample chart data
  const sentimentData = [
    { name: t("feedback.page.positive"), value: metrics.sentimentScore, sentiment: 1 },
    { name: t("feedback.page.neutral"), value: 100 - metrics.sentimentScore - 10, sentiment: 0 },
    { name: t("feedback.page.negative"), value: 10, sentiment: -1 }
  ]

  const categorizationData = [
    { name: t("feedback.page.bugReports"), value: 45 },
    { name: t("feedback.page.featureRequests"), value: 30 },
    { name: t("feedback.page.general"), value: 25 }
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
           <h1 className="text-2xl font-bold text-foreground">{t("feedback.page.title")}</h1>
           <p className="text-sm text-muted-foreground">
             {total} {t("feedback.page.item", { count: total })} — {t("feedback.page.subtitle")}
           </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => fetchFeedback()} className="gap-1 text-sm">
            <RefreshCw className="h-3 w-3" />
            {t("feedback.page.refresh")}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
               <Button variant="outline" size="sm" className="gap-1 text-sm">
                 <MessageSquare className="h-3 w-3" />
                 {t("feedback.page.newFeedback")}
               </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <DialogHeader>
                   <DialogTitle>{t("feedback.page.formTitle")}</DialogTitle>
                   <DialogDescription>
                     {t("feedback.page.formDescription")}
                   </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                     <Label htmlFor="fb-title">{t("feedback.page.title")} *</Label>
                    <Input
                      id="fb-title"
                       placeholder={t("feedback.page.titlePlaceholder")}
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      maxLength={300}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                     <Label htmlFor="fb-body">{t("feedback.page.body")}</Label>
                    <Textarea
                      id="fb-body"
                       placeholder={t("feedback.page.bodyPlaceholder")}
                      value={form.body}
                      onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                      rows={4}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                       <Label>{t("feedback.page.type")}</Label>
                      <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as FeedbackType }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                           {FEEDBACK_TYPES.map((type) => (
              <SelectItem key={type} value={type}>{t("feedback.page." + type)}</SelectItem>
                           ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                       <Label>{t("feedback.page.priority")}</Label>
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
                      <Label htmlFor="fb-category">{t("feedback.page.category")}</Label>
                      <Input
                        id="fb-category"
                        placeholder={t("feedback.page.categoryPlaceholder")}
                        value={form.category}
                        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="fb-rating">{t("feedback.page.rating")}</Label>
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
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("feedback.page.cancel")}</Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("feedback.page.submit")}
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
             <CardTitle className="text-sm font-medium">{t("feedback.page.sentimentAnalysis")}</CardTitle>
            <Smile className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.sentimentScore}%</div>
             <p className="text-xs text-muted-foreground">{t("feedback.page.positiveSentiment")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">{t("feedback.page.responseTime")}</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.responseTime}h</div>
             <p className="text-xs text-muted-foreground">{t("feedback.page.avgResponseTime")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">{t("feedback.page.categorization")}</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.categorizationRate}%</div>
             <p className="text-xs text-muted-foreground">{t("feedback.page.categorized")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">{t("feedback.page.responseRate")}</CardTitle>
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
             <SelectItem value="all">{t("feedback.page.all")} {t("feedback.page.status").toLowerCase()}</SelectItem>
            {FEEDBACK_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>{t(`feedback.page.${toI18nKey(status)}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as FeedbackType | 'all')}>
           <SelectTrigger className="w-36"><SelectValue placeholder={t("feedback.page.all") + " " + t("feedback.page.type").toLowerCase()} /></SelectTrigger>
          <SelectContent>
             <SelectItem value="all">{t("feedback.page.all")} {t("feedback.page.type").toLowerCase()}</SelectItem>
            {FEEDBACK_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as 'recent' | 'votes')}>
           <SelectTrigger className="w-32"><SelectValue placeholder={t("feedback.page.sortBy")} /></SelectTrigger>
           <SelectContent>
             <SelectItem value="recent">{t("feedback.page.recent")}</SelectItem>
             <SelectItem value="votes">{t("feedback.page.votes")}</SelectItem>
           </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive/60" />
             <CardTitle className="text-base">{error}</CardTitle>
             <Button variant="outline" onClick={() => fetchFeedback()}>{t("feedback.page.tryAgain")}</Button>
          </CardContent>
        </Card>
      ) : feedback.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <MessageSquarePlus className="h-10 w-10 text-muted-foreground/40" />
             <CardTitle className="text-base">{t("feedback.page.noFeedback")}</CardTitle>
             <CardDescription>{t("feedback.page.beFirst")}</CardDescription>
             <Button variant="outline" onClick={() => setOpen(true)}>{t("feedback.page.submitFeedback")}</Button>
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
                       aria-label={t("feedback.page.voteFor", { title: item.title })}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      <span className="font-medium">{item.vote_count}</span>
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="pb-3 pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[item.status]}`}>
                       {t(`feedback.page.${toI18nKey(item.status)}`)}
                    </Badge>
                    <Badge variant="secondary" className={`text-xs ${PRIORITY_COLORS[item.priority]}`}>
                       {t(`feedback.page.${item.priority}`)}
                    </Badge>
                    {item.category && item.category !== 'general' && (
                      <Badge variant="outline" className="text-xs">{item.category}</Badge>
                    )}
                    {item.rating && (
                      <span className="text-xs text-muted-foreground">{'★'.repeat(item.rating)}</span>
                    )}
                     <span className="ml-auto text-xs text-muted-foreground">
                       {t("feedback.page.createdAt")}: {new Date(item.created_at).toLocaleDateString()}
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