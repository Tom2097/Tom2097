"use client"

import { useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Lightbulb, Target, TrendingUp, Star, Handshake, MessageSquare, Loader2, Plus } from "lucide-react"
import { useI18n } from "@/components/providers/i18n-provider"

interface DesignPartner {
  id: string
  name: string
  company: string
  email: string
  stage: "awareness" | "evaluation" | "pilot" | "launch" | "advocate"
  vertical: string
  feedbackScore: number
  lastTouchpoint: string
  notes: string
}

const PIPELINE_STAGES: { id: DesignPartner["stage"]; icon: React.ElementType; color: string }[] = [
  { id: "awareness", icon: Lightbulb, color: "text-blue-500" },
  { id: "evaluation", icon: Target, color: "text-purple-500" },
  { id: "pilot", icon: TrendingUp, color: "text-yellow-500" },
  { id: "launch", icon: Handshake, color: "text-green-500" },
  { id: "advocate", icon: Star, color: "text-orange-500" },
]

export function DesignPartnerView() {
  const { t } = useI18n()
  const { data, isLoading, mutate } = useSWR<{ partners: DesignPartner[] }>('/api/v1/design-partners', (url: string) => fetch(url).then(r => r.json()))
  const partners = data?.partners ?? []
  const [activeTab, setActiveTab] = useState("pipeline")
  const [selectedPartner, setSelectedPartner] = useState<DesignPartner | null>(null)
  const [notesDialogOpen, setNotesDialogOpen] = useState(false)
  const [noteText, setNoteText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [newPartner, setNewPartner] = useState({ name: "", company: "", email: "", vertical: "" })
  const [adding, setAdding] = useState(false)

  const getStagePartners = (stage: string) => partners.filter(p => p.stage === stage)

  const handleAddPartner = async () => {
    if (!newPartner.name.trim() || !newPartner.company.trim() || !newPartner.email.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/v1/design-partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPartner),
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to add partner')
      }
      toast.success('Design partner added')
      setAddOpen(false)
      setNewPartner({ name: "", company: "", email: "", vertical: "" })
      mutate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add partner')
    } finally {
      setAdding(false)
    }
  }

  const handleMoveStage = async (partnerId: string, newStage: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/design-partners/${partnerId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || t('designPartner.page.errors.moveFailed'))
      }
      const data = await res.json()
      await mutate({
        partners: partners.map(p => p.id === partnerId ? { ...data.partner } : p)
      }, false)
      toast.success(t('designPartner.page.success.moved'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('designPartner.page.errors.moveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveNote = async () => {
    if (!selectedPartner || !noteText.trim()) {
      toast.error(t('designPartner.page.errors.noteEmpty'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/design-partners/${selectedPartner.id}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: noteText }),
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || t('designPartner.page.errors.saveNoteFailed'))
      }
      const data = await res.json()
      await mutate({
        partners: partners.map(p => p.id === selectedPartner.id ? { ...data.partner } : p)
      }, false)
      toast.success(t('designPartner.page.success.noteSaved'))
      setNoteText("")
      setNotesDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('designPartner.page.errors.saveNoteFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const topVertical = Array.from(new Set(partners.map(p => p.vertical))).sort((a, b) =>
    partners.filter(p => p.vertical === b).length - partners.filter(p => p.vertical === a).length
  )[0]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('designPartner.page.title')}</h1>
          <p className="text-muted-foreground">{t('designPartner.page.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-primary">
            <Star className="mr-1 h-3 w-3" />
            {t('designPartner.page.activePartners', { count: partners.length })}
          </Badge>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Design Partner</DialogTitle>
                <DialogDescription>Track a new company piloting the platform</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={newPartner.name} onChange={(e) => setNewPartner((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Input value={newPartner.company} onChange={(e) => setNewPartner((p) => ({ ...p, company: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={newPartner.email} onChange={(e) => setNewPartner((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Vertical</Label>
                  <Input value={newPartner.vertical} onChange={(e) => setNewPartner((p) => ({ ...p, vertical: e.target.value }))} placeholder="Healthcare, Banking, ..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={handleAddPartner} disabled={!newPartner.name.trim() || !newPartner.company.trim() || !newPartner.email.trim() || adding}>
                  {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add Partner
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          </CardContent>
        </Card>
      ) : (
      <>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pipeline">{t('designPartner.page.tabs.pipeline')}</TabsTrigger>
          <TabsTrigger value="board">{t('designPartner.page.tabs.board')}</TabsTrigger>
          <TabsTrigger value="insights">{t('designPartner.page.tabs.insights')}</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('designPartner.page.allPartners')}</CardTitle>
              <CardDescription>{t('designPartner.page.trackPartners')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('designPartner.page.table.name')}</TableHead>
                    <TableHead>{t('designPartner.page.table.company')}</TableHead>
                    <TableHead>{t('designPartner.page.table.stage')}</TableHead>
                    <TableHead>{t('designPartner.page.table.vertical')}</TableHead>
                    <TableHead>{t('designPartner.page.table.feedbackScore')}</TableHead>
                    <TableHead>{t('designPartner.page.table.lastTouchpoint')}</TableHead>
                    <TableHead>{t('designPartner.page.table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map(partner => {
                    const stageInfo = PIPELINE_STAGES.find(s => s.id === partner.stage)
                    const StageIcon = stageInfo?.icon || Lightbulb
                    return (
                      <TableRow key={partner.id}>
                        <TableCell className="font-medium">{partner.name}</TableCell>
                        <TableCell>{partner.company}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={stageInfo?.color}>
                            <StageIcon className="mr-1 h-3 w-3" />
                            {stageInfo ? t(`designPartner.page.stages.${stageInfo.id}`) : partner.stage}
                          </Badge>
                        </TableCell>
                        <TableCell>{partner.vertical}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-20 rounded-full bg-secondary">
                              <div className="h-2 rounded-full bg-primary" style={{ width: `${partner.feedbackScore}%` }} />
                            </div>
                            <span className="text-xs">{partner.feedbackScore}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{partner.lastTouchpoint}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => {
                              setSelectedPartner(partner)
                              setNotesDialogOpen(true)
                            }}>
                              <MessageSquare className="h-3 w-3" />
                            </Button>
                            {partner.stage === "awareness" && (
                              <Button size="sm" onClick={() => handleMoveStage(partner.id, "evaluation")} disabled={submitting}>
                                {submitting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                {t('designPartner.page.startEvaluation')}
                              </Button>
                            )}
                            {partner.stage === "evaluation" && (
                              <Button size="sm" onClick={() => handleMoveStage(partner.id, "pilot")} disabled={submitting}>
                                {submitting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                {t('designPartner.page.startPilot')}
                              </Button>
                            )}
                            {partner.stage === "pilot" && (
                              <Button size="sm" onClick={() => handleMoveStage(partner.id, "launch")} disabled={submitting}>
                                {submitting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                {t('designPartner.page.launch')}
                              </Button>
                            )}
                            {partner.stage === "launch" && (
                              <Button size="sm" variant="secondary" onClick={() => handleMoveStage(partner.id, "advocate")} disabled={submitting}>
                                {submitting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                {t('designPartner.page.markAdvocate')}
                              </Button>
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
        </TabsContent>

        <TabsContent value="board" className="mt-4">
          <div className="grid grid-cols-5 gap-4">
            {PIPELINE_STAGES.map(stage => {
              const StageIcon = stage.icon
              const stagePartners = getStagePartners(stage.id)
              return (
                <Card key={stage.id}>
                  <CardHeader className="p-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <StageIcon className={`h-4 w-4 ${stage.color}`} />
                      {t(`designPartner.page.stages.${stage.id}`)}
                      <Badge variant="secondary" className="ml-auto">{stagePartners.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-2">
                    {stagePartners.map(partner => (
                      <div key={partner.id} className="rounded-lg border p-2 text-xs space-y-1">
                        <p className="font-medium">{partner.name}</p>
                        <p className="text-muted-foreground">{partner.company}</p>
                        <p className="text-muted-foreground">{partner.vertical}</p>
                      </div>
                    ))}
                    {stagePartners.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">{t('designPartner.page.noPartners')}</p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('designPartner.page.partnerDistribution')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {PIPELINE_STAGES.map(stage => {
                    const count = getStagePartners(stage.id).length
                    const total = partners.length || 1
                    return (
                      <div key={stage.id} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{t(`designPartner.page.stages.${stage.id}`)}</span>
                          <span>{Math.round((count / total) * 100)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary">
                          <div className="h-2 rounded-full bg-primary" style={{ width: `${(count / total) * 100}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('designPartner.page.verticalBreakdown')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from(new Set(partners.map(p => p.vertical))).map(vertical => {
                    const count = partners.filter(p => p.vertical === vertical).length
                    return (
                      <div key={vertical} className="flex items-center justify-between text-sm">
                        <span>{vertical}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">{t('designPartner.page.dailyBrief')}</CardTitle>
                <CardDescription>{t('designPartner.page.dailyBriefDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">• {t('designPartner.page.bullet.launch', { count: getStagePartners("launch").length })}</p>
                <p className="text-sm">• {t('designPartner.page.bullet.pilot', { count: getStagePartners("pilot").length })}</p>
                <p className="text-sm">• {t('designPartner.page.bullet.avgScore', { score: Math.round(partners.reduce((s, p) => s + p.feedbackScore, 0) / partners.length) })}</p>
                <p className="text-sm">• {t('designPartner.page.bullet.topVertical', { vertical: topVertical })}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('designPartner.page.dialog.title', { name: selectedPartner?.name ?? '' })}</DialogTitle>
            <DialogDescription>{t('designPartner.page.dialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('designPartner.page.dialog.currentNotes')}</Label>
              <p className="text-sm text-muted-foreground mt-1 p-3 bg-muted rounded-md">{selectedPartner?.notes}</p>
            </div>
            <div className="space-y-2">
              <Label>{t('designPartner.page.dialog.addNote')}</Label>
              <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>{t('designPartner.page.dialog.close')}</Button>
            <Button onClick={handleSaveNote} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('designPartner.page.dialog.saveNote')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>)}
    </div>
  )
}
