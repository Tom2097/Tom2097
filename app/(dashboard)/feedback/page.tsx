'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { ThumbsUp, MessageSquarePlus, Search, Loader2, Bug, Lightbulb, TrendingUp, HelpCircle, MessageSquare, RefreshCw, BarChart2, Smile, Frown, Meh, Brain, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  Feedback,
  FeedbackType,
  FeedbackStatus,
  FeedbackPriority,
} from '@/lib/feedback/types'
import { FEEDBACK_TYPES, FEEDBACK_STATUSES, FEEDBACK_PRIORITIES } from '@/lib/feedback/types'

const TYPE_ICONS: Record<FeedbackType, React.ElementType> = {
  bug: Bug,
  feature: Lightbulb,
  improvement: TrendingUp,
  question: HelpCircle,
  general: MessageSquare,
}

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  open: 'bg-blue-500/10 text-blue-500',
  triaged: 'bg-yellow-500/10 text-yellow-500',
  in_progress: 'bg-primary/10 text-primary',
  resolved: 'bg-green-500/10 text-green-500',
  closed: 'bg-muted text-muted-foreground',
  wont_fix: 'bg-destructive/10 text-destructive',
}

const PRIORITY_COLORS: Record<FeedbackPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  normal: 'bg-blue-500/10 text-blue-500',
  high: 'bg-yellow-500/10 text-yellow-600',
  urgent: 'bg-destructive/10 text-destructive',
}

export default function FeedbackPage() {
  const [items, setItems] = useState<Feedback[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | 'all'>('all')
  const [filterType, setFilterType] = useState<FeedbackType | 'all'>('all')
  const [sort, setSort] = useState<'recent' | 'votes'>('recent')
  const [submitting, setSubmitting] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    body: '',
    type: 'general' as FeedbackType,
    priority: 'normal' as FeedbackPriority,
    category: 'general',
    rating: '' as string,
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState({
    sentimentScore: 0,
    responseTime: 0,
    categorizationAccuracy: 0,
    openItems: 0,
    responseRate: 0,
  })
  const [sentimentData, setSentimentData] = useState<Array<{ name: string; value: number; sentiment: number }>>([])
  const [categorizationData, setCategorizationData] = useState<Array<{ name: string; value: number }>>([])

  const fetchFeedback = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50', offset: '0', sort })
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (filterType !== 'all') params.set('type', filterType)
      if (search.trim()) params.set('search', search.trim())
      const res = await fetch(`/api/v1/feedback?${params}`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setItems(data.feedback ?? [])
      setTotal(data.total ?? 0)
      
      // Update metrics
      const openItems = data.feedback?.filter((f: Feedback) => f.status === 'open' || f.status === 'triaged').length || 0
      const responseRate = data.feedback?.length > 0 ? Math.round(((data.feedback.length - openItems) / data.feedback.length) * 100) : 0
      
      setMetrics({
        sentimentScore: 78, // Mock sentiment score
        responseTime: 4.2, // Mock response time in hours
        categorizationAccuracy: 92, // Mock categorization accuracy
        openItems,
        responseRate,
      })
      
      // Update sentiment data
      const sentimentMap = { positive: 0, neutral: 0, negative: 0 }
      data.feedback?.forEach((f: Feedback) => {
        if (f.rating && f.rating >= 4) sentimentMap.positive++
        else if (f.rating && f.rating <= 2) sentimentMap.negative++
        else sentimentMap.neutral++
      })
      
      setSentimentData([
        { name: 'Positive', value: sentimentMap.positive, sentiment: 1 },
        { name: 'Neutral', value: sentimentMap.neutral, sentiment: 0 },
        { name: 'Negative', value: sentimentMap.negative, sentiment: -1 },
      ])
      
      // Update categorization data
      const categoryMap: Record<string, number> = {}
      data.feedback?.forEach((f: Feedback) => {
        const category = f.category || 'general'
        categoryMap[category] = (categoryMap[category] || 0) + 1
      })
      
      const categorizationArray = Object.entries(categoryMap).map(([name, value]) => ({ name, value }))
      setCategorizationData(categorizationArray.slice(0, 5))
      
    } catch {
      // silently leave previous items displayed
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterType, sort, search])

  useEffect(() => {
    fetchFeedback()
    
    // Simulate real-time updates
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        sentimentScore: Math.floor(Math.random() * 20) + 70,
        responseTime: (Math.random() * 10).toFixed(1),
      }))
    }, 5000)
    
    return () => clearInterval(interval)
  }, [fetchFeedback])

  const handleVote = async (id: string) => {
    await fetch(`/api/v1/feedback/${id}/vote`, { method: 'POST' })
    fetchFeedback()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!form.title.trim()) { setFormError('Title is required'); return }
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        body: form.body.trim() || null,
        type: form.type,
        priority: form.priority,
        category: form.category.trim() || 'general',
      }
      if (form.rating) payload.rating = Number(form.rating)
      const res = await fetch('/api/v1/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        setFormError(err.error ?? 'Failed to submit feedback')
        return
      }
      setOpen(false)
      setForm({ title: '', body: '', type: 'general', priority: 'normal', category: 'general', rating: '' })
      fetchFeedback()
    } catch {
      setFormError('Unexpected error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

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
           <Button variant="ghost" size="sm" onClick={fetchFeedback} className="gap-1 text-sm">
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
                      <Label htmlFor="fb-type">Type</Label>
                      <Select
                        value={form.type}
                        onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
                      >
                        <SelectTrigger id="fb-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bug">Bug Report</SelectItem>
                          <SelectItem value="feature">Feature Request</SelectItem>
                          <SelectItem value="general">General Feedback</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="fb-message">Message</Label>
                      <Textarea
                        id="fb-message"
                        placeholder="Describe your feedback..."
                        value={form.message}
                        onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                        rows={4}
                      />
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

      {/* Analytics Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartContainer title="Sentiment Analysis" subtitle="Feedback sentiment distribution">
          <div className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sentimentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]}>
                  {sentimentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.sentiment > 0 ? '#10b981' : entry.sentiment < 0 ? '#ef4444' : '#6b7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>

        <ChartContainer title="Feedback Categorization" subtitle="Top categories">
          <div className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categorizationData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>
      </div>

      {/* Response Tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Response Tracking</span>
            {metrics.openItems > 5 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {metrics.openItems} open
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[
                { name: 'Week 1', responded: 15, open: 8 },
                { name: 'Week 2', responded: 18, open: 6 },
                { name: 'Week 3', responded: 22, open: 4 },
                { name: 'Week 4', responded: 20, open: 7 },
                { name: 'Current', responded: total - metrics.openItems, open: metrics.openItems },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="responded" stroke="#10b981" strokeWidth={2} name="Responded" />
                <Line type="monotone" dataKey="open" stroke="#ef4444" strokeWidth={2} name="Open" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <MessageSquarePlus className="h-4 w-4" />
              Submit Feedback
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Submit Feedback</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
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
                  rows={4}
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
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
      ) : items.length === 0 ? (
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
          {items.map((item) => {
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
                    <Badge variant="secondary" className={cn('text-xs', STATUS_COLORS[item.status])}>
                      {item.status.replace('_', ' ')}
                    </Badge>
                    <Badge variant="secondary" className={cn('text-xs', PRIORITY_COLORS[item.priority])}>
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
