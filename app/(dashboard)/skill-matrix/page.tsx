'use client'

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
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
  BarChart3,
  Users,
  GraduationCap,
  AlertTriangle,
  Plus,
  Loader2,
  BookOpen,
  Target,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/components/providers/i18n-provider'

interface Skill {
  id: string
  name: string
  category: 'technical' | 'domain' | 'soft' | 'compliance'
  expectedLevel: string
}

interface SkillAssessment {
  userId: string
  skillId: string
  actualLevel: string
  lastAssessed: string
  notes?: string
}

interface GapAnalysis {
  skillId: string
  skillName: string
  category: string
  expectedLevel: string
  actualLevel: string
  gap: 'none' | 'small' | 'medium' | 'large'
  priority: 'low' | 'medium' | 'high' | 'critical'
}

interface TeamMember {
  id: string
  name: string
}

const CATEGORIES: { key: string; color: string }[] = [
  { key: 'technical', color: 'text-blue-500' },
  { key: 'domain', color: 'text-emerald-500' },
  { key: 'soft', color: 'text-purple-500' },
  { key: 'compliance', color: 'text-amber-500' },
]

const GAP_COLORS: Record<string, string> = {
  none: 'text-green-500 bg-green-500/10',
  small: 'text-amber-500 bg-amber-500/10',
  medium: 'text-orange-500 bg-orange-500/10',
  large: 'text-red-500 bg-red-500/10',
}

const GAP_BG: Record<string, string> = {
  none: 'bg-green-500',
  small: 'bg-amber-500',
  medium: 'bg-orange-500',
  large: 'bg-red-500',
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-500/10 text-blue-500',
  high: 'bg-amber-500/10 text-amber-500',
  critical: 'bg-red-500/10 text-red-500',
}

const LEVEL_ORDER: Record<string, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
}

export default function SkillMatrixPage() {
  const { t } = useI18n()
  const [catalog, setCatalog] = useState<Skill[]>([])
  const [assessments, setAssessments] = useState<SkillAssessment[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [assessDialogOpen, setAssessDialogOpen] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<string | null>('technical')
  const [submitting, setSubmitting] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [form, setForm] = useState({ userId: '', skillId: '', level: '' })

  const levelOptions = ['beginner', 'intermediate', 'advanced', 'expert']

  const handleNavigateToTraining = async (skillId: string) => {
    setNavigating(true)
    try {
      const skill = catalog.find(s => s.id === skillId)
      if (!skill) throw new Error(t('skillMatrix.page.errors.skillNotFound'))
      toast.success(t('skillMatrix.page.success.navigating', { skillName: skill.name }))
      window.open(`/training/${skill.id}`, "_blank")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('skillMatrix.page.errors.skillNotFound'))
    } finally {
      setNavigating(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/v1/hr/skills?include=assessments')
        const data = await res.json()
        if (!cancelled) {
          setCatalog(data.catalog ?? [])
          setAssessments(data.assessments ?? [])
          setTeamMembers(data.teamMembers ?? [])
        }
      } catch {
        if (!cancelled) toast.error(t('skillMatrix.page.errors.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [t])

  const gaps = useMemo((): GapAnalysis[] => {
    if (catalog.length === 0 || assessments.length === 0) return []
    const result: GapAnalysis[] = []
    for (const skill of catalog) {
      const skillAssessments = assessments.filter((a) => a.skillId === skill.id)
      if (skillAssessments.length === 0) continue
      const avg = skillAssessments.reduce((s, a) => s + (LEVEL_ORDER[a.actualLevel] ?? 0), 0) / skillAssessments.length
      const avgKey = Object.entries(LEVEL_ORDER).reduce((best, [key, val]) =>
        Math.abs(val - Math.round(avg)) < Math.abs(LEVEL_ORDER[best] - Math.round(avg)) ? key : best
      , 'beginner')
      const diff = (LEVEL_ORDER[skill.expectedLevel] ?? 0) - (LEVEL_ORDER[avgKey] ?? 0)
      const gap: GapAnalysis['gap'] = diff <= 0 ? 'none' : diff === 1 ? 'small' : diff === 2 ? 'medium' : 'large'
      const baseExpected = LEVEL_ORDER[skill.expectedLevel] ?? 0
      const priority: GapAnalysis['priority'] = gap === 'none' ? 'low' : gap === 'small' ? (baseExpected >= 4 ? 'medium' : 'low') : gap === 'medium' ? (baseExpected >= 3 ? 'high' : 'medium') : baseExpected >= 2 ? 'critical' : 'high'
      result.push({ skillId: skill.id, skillName: skill.name, category: skill.category, expectedLevel: skill.expectedLevel, actualLevel: avgKey, gap, priority })
    }
    result.sort((a, b) => {
      const order = ['critical', 'high', 'medium', 'low']
      return order.indexOf(a.priority) - order.indexOf(b.priority)
    })
    return result
  }, [catalog, assessments])

  const recommendations = useMemo((): Array<{ text: string; skillId: string | null }> => {
    if (gaps.length === 0) return []
    const recs: Array<{ text: string; skillId: string | null }> = []
    for (const g of gaps) {
      if (g.priority === 'critical' || g.priority === 'high') {
        recs.push({ text: t('skillMatrix.page.advancedCertification', { skillName: g.skillName, gap: g.gap }), skillId: g.skillId })
      } else if (g.priority === 'medium') {
        recs.push({ text: t('skillMatrix.page.intermediateWorkshop', { skillName: g.skillName, gap: g.gap }), skillId: g.skillId })
      }
    }
    if (recs.length === 0) recs.push({ text: t('skillMatrix.page.noCriticalGaps'), skillId: null })
    return recs
  }, [gaps, t])

  const handleAssess = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.userId || !form.skillId || !form.level) {
      toast.error(t('skillMatrix.page.errors.fillAllFields'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/hr/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? t('skillMatrix.page.errors.assessFailed'))
        return
      }
      toast.success(t('skillMatrix.page.success.assessed'))
      setAssessDialogOpen(false)
      setForm({ userId: '', skillId: '', level: '' })
      const assessRes = await fetch('/api/v1/hr/skills?include=assessments')
      const assessData = await assessRes.json()
      if (assessData.assessments) setAssessments(assessData.assessments)
    } catch {
      toast.error(t('skillMatrix.page.errors.assessFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const getLevelBadge = (level: string | undefined) => {
    if (!level) return null
    const colors: Record<string, string> = {
      beginner: 'bg-slate-500/10 text-slate-500',
      intermediate: 'bg-blue-500/10 text-blue-500',
      advanced: 'bg-purple-500/10 text-purple-500',
      expert: 'bg-amber-500/10 text-amber-500',
    }
    return (
      <Badge variant="secondary" className={cn('text-xs capitalize', colors[level] ?? '')}>
        {t(`skillMatrix.page.levels.${level}`)}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const catalogByCategory = CATEGORIES.map((cat) => ({
    ...cat,
    label: t(`skillMatrix.page.categories.${cat.key}`),
    skills: catalog.filter((s) => s.category === cat.key),
  }))

  const criticalCount = gaps.filter((g) => g.priority === 'critical').length
  const highCount = gaps.filter((g) => g.priority === 'high').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-500">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('skillMatrix.page.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('skillMatrix.page.subtitle')}</p>
          </div>
        </div>
        <Dialog open={assessDialogOpen} onOpenChange={setAssessDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t('skillMatrix.page.assessSkill')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('skillMatrix.page.dialogTitle')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAssess} className="flex flex-col gap-4 pt-2">
              <div className="flex flex-col gap-1.5">
                <Label>{t('skillMatrix.page.teamMember')}</Label>
                <Select value={form.userId} onValueChange={(v) => setForm((f) => ({ ...f, userId: v }))}>
                  <SelectTrigger><SelectValue placeholder={t('skillMatrix.page.selectMember')} /></SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('skillMatrix.page.skill')}</Label>
                <Select value={form.skillId} onValueChange={(v) => setForm((f) => ({ ...f, skillId: v }))}>
                  <SelectTrigger><SelectValue placeholder={t('skillMatrix.page.selectSkill')} /></SelectTrigger>
                  <SelectContent>
                    {catalog.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t('skillMatrix.page.level')}</Label>
                <Select value={form.level} onValueChange={(v) => setForm((f) => ({ ...f, level: v }))}>
                  <SelectTrigger><SelectValue placeholder={t('skillMatrix.page.selectLevel')} /></SelectTrigger>
                  <SelectContent>
                    {levelOptions.map((l) => (
                      <SelectItem key={l} value={l}>{t(`skillMatrix.page.levels.${l}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setAssessDialogOpen(false)}>{t('skillMatrix.page.cancel')}</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('skillMatrix.page.submit')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <GraduationCap className="h-5 w-5 text-indigo-500" />
              <div>
                <p className="text-sm text-muted-foreground">{t('skillMatrix.page.skillsTracked')}</p>
                <p className="text-2xl font-bold text-foreground">{catalog.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">{t('skillMatrix.page.assessments')}</p>
                <p className="text-2xl font-bold text-foreground">{assessments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">{t('skillMatrix.page.criticalGaps')}</p>
                <p className="text-2xl font-bold text-red-500">{criticalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">{t('skillMatrix.page.highPriority')}</p>
                <p className="text-2xl font-bold text-amber-500">{highCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-indigo-500" />
              {t('skillMatrix.page.skillCatalog')}
            </CardTitle>
            <CardDescription>{t('skillMatrix.page.skillCatalogDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {catalogByCategory.map((cat) => (
                <div key={cat.key}>
                  <button
                    onClick={() => setExpandedCategory(expandedCategory === cat.key ? null : cat.key)}
                    className="flex w-full items-center justify-between rounded-lg bg-secondary/30 px-3 py-2 text-sm font-medium"
                  >
                    <span className={`flex items-center gap-2 ${cat.color}`}>
                      {expandedCategory === cat.key ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      {cat.label}
                    </span>
                    <Badge variant="secondary" className="text-xs">{cat.skills.length}</Badge>
                  </button>
                  {expandedCategory === cat.key && (
                    <div className="mt-1 space-y-1 px-2">
                      {cat.skills.map((skill) => (
                        <div key={skill.id} className="flex items-center justify-between rounded-md px-3 py-1.5 text-sm hover:bg-secondary/20">
                          <span>{skill.name}</span>
                          <Badge variant="outline" className="text-xs capitalize">{t(`skillMatrix.page.levels.${skill.expectedLevel}`)}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-5 w-5 text-indigo-500" />
              {t('skillMatrix.page.teamAssessmentGrid')}
            </CardTitle>
            <CardDescription>{t('skillMatrix.page.teamAssessmentDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('skillMatrix.page.member')}</TableHead>
                  <TableHead>{t('skillMatrix.page.skill')}</TableHead>
                  <TableHead>{t('skillMatrix.page.level')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                      {t('skillMatrix.page.noAssessments')}
                    </TableCell>
                  </TableRow>
                ) : (
                  assessments.map((a, i) => {
                    const skill = catalog.find((s) => s.id === a.skillId)
                    const member = teamMembers.find((m) => m.id === a.userId)
                    return (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{member?.name ?? a.userId}</TableCell>
                        <TableCell className="text-sm">{skill?.name ?? a.skillId}</TableCell>
                        <TableCell>{getLevelBadge(a.actualLevel)}</TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-indigo-500" />
            {t('skillMatrix.page.gapAnalysis')}
          </CardTitle>
          <CardDescription>{t('skillMatrix.page.gapAnalysisDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('skillMatrix.page.skill')}</TableHead>
                <TableHead>{t('skillMatrix.page.category')}</TableHead>
                <TableHead>{t('skillMatrix.page.expected')}</TableHead>
                <TableHead>{t('skillMatrix.page.actual')}</TableHead>
                <TableHead>{t('skillMatrix.page.gap')}</TableHead>
                <TableHead>{t('skillMatrix.page.priority')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gaps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    {t('skillMatrix.page.noGapData')}
                  </TableCell>
                </TableRow>
              ) : (
                gaps.map((g) => (
                  <TableRow key={g.skillId}>
                    <TableCell className="font-medium">{g.skillName}</TableCell>
                    <TableCell className="capitalize">{t(`skillMatrix.page.categories.${g.category}`)}</TableCell>
                    <TableCell className="capitalize">{t(`skillMatrix.page.levels.${g.expectedLevel}`)}</TableCell>
                    <TableCell className="capitalize">{t(`skillMatrix.page.levels.${g.actualLevel}`)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={cn('h-2.5 w-2.5 rounded-full', GAP_BG[g.gap])} />
                        <span className={cn('text-xs font-medium capitalize', GAP_COLORS[g.gap])}>{g.gap}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn('text-xs capitalize', PRIORITY_COLORS[g.priority])}>
                        {g.priority}
                      </Badge>
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
             <CheckCircle2 className="h-5 w-5 text-emerald-500" />
             {t('skillMatrix.page.recommendedTraining')}
           </CardTitle>
           <CardDescription>{t('skillMatrix.page.recommendedTrainingDesc')}</CardDescription>
         </CardHeader>
         <CardContent>
           {recommendations.length === 0 ? (
             <p className="text-sm text-muted-foreground py-4">{t('skillMatrix.page.noRecommendations')}</p>
           ) : (
             <div className="space-y-2">
               {recommendations.map((rec, i) => (
                 <div key={i} className="flex items-start gap-3 rounded-lg bg-secondary/30 p-3">
                   <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                   <span className="text-sm flex-1">{rec.text}</span>
                   {rec.skillId && (
                     <Button
                       variant="ghost"
                       size="sm"
                       className="h-7 w-7 p-1 text-indigo-500 hover:text-indigo-600"
                       onClick={() => handleNavigateToTraining(rec.skillId as string)}
                       disabled={navigating}
                     >
                       <ExternalLink className="h-3.5 w-3.5" />
                     </Button>
                   )}
                 </div>
               ))}
             </div>
           )}
         </CardContent>
       </Card>
    </div>
  )
}
