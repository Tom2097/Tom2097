"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Lightbulb, Target, TrendingUp, Users, Star, Handshake, MessageSquare } from "lucide-react"

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

const PIPELINE_STAGES = [
  { id: "awareness", label: "Awareness", icon: Lightbulb, color: "text-blue-500" },
  { id: "evaluation", label: "Evaluation", icon: Target, color: "text-purple-500" },
  { id: "pilot", label: "Pilot", icon: TrendingUp, color: "text-yellow-500" },
  { id: "launch", label: "Launch", icon: Handshake, color: "text-green-500" },
  { id: "advocate", label: "Advocate", icon: Star, color: "text-orange-500" },
]

const SAMPLE_PARTNERS: DesignPartner[] = [
  { id: "1", name: "Rajesh Kumar", company: "TechCorp India", email: "rajesh@techcorp.in", stage: "pilot", vertical: "Healthcare", feedbackScore: 88, lastTouchpoint: "2026-07-01", notes: "Testing compliance workspace" },
  { id: "2", name: "Sarah Chen", company: "FinServe Asia", email: "sarah@finserve.sg", stage: "evaluation", vertical: "Banking", feedbackScore: 72, lastTouchpoint: "2026-06-28", notes: "Interested in AI Intelligence" },
  { id: "3", name: "Michael Okafor", company: "Lagos Manufacturing", email: "michael@lagosmfg.ng", stage: "awareness", vertical: "Manufacturing", feedbackScore: 45, lastTouchpoint: "2026-06-25", notes: "Initial demo completed" },
  { id: "4", name: "Ananya Patel", company: "MediChain Health", email: "ananya@medichain.in", stage: "launch", vertical: "Healthcare", feedbackScore: 95, lastTouchpoint: "2026-07-03", notes: "Going live next week" },
  { id: "5", name: "James Wilson", company: "EduTech Global", email: "james@edutech.io", stage: "advocate", vertical: "Education", feedbackScore: 92, lastTouchpoint: "2026-07-02", notes: "Provided testimonial, referring 2 more" },
]

export default function DesignPartnerPipeline() {
  const [partners, setPartners] = useState<DesignPartner[]>(SAMPLE_PARTNERS)
  const [activeTab, setActiveTab] = useState("pipeline")
  const [selectedPartner, setSelectedPartner] = useState<DesignPartner | null>(null)
  const [notesDialogOpen, setNotesDialogOpen] = useState(false)
  const [noteText, setNoteText] = useState("")

  const getStagePartners = (stage: string) => partners.filter(p => p.stage === stage)

  const moveStage = (partnerId: string, newStage: string) => {
    setPartners(prev => prev.map(p => 
      p.id === partnerId ? { ...p, stage: newStage as DesignPartner["stage"] } : p
    ))
    toast.success("Partner moved to next stage")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Design Partner Pipeline</h1>
          <p className="text-muted-foreground">Founder-led early sales and partner management</p>
        </div>
        <Badge variant="outline" className="text-primary">
          <Star className="mr-1 h-3 w-3" />
          {partners.length} Active Partners
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="board">Kanban Board</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All Design Partners</CardTitle>
              <CardDescription>Track partner relationships from awareness to advocacy</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Vertical</TableHead>
                    <TableHead>Feedback Score</TableHead>
                    <TableHead>Last Touchpoint</TableHead>
                    <TableHead>Actions</TableHead>
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
                            {stageInfo?.label}
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
                              <Button size="sm" onClick={() => moveStage(partner.id, "evaluation")}>
                                Start Evaluation
                              </Button>
                            )}
                            {partner.stage === "evaluation" && (
                              <Button size="sm" onClick={() => moveStage(partner.id, "pilot")}>
                                Start Pilot
                              </Button>
                            )}
                            {partner.stage === "pilot" && (
                              <Button size="sm" onClick={() => moveStage(partner.id, "launch")}>
                                Launch
                              </Button>
                            )}
                            {partner.stage === "launch" && (
                              <Button size="sm" variant="secondary" onClick={() => moveStage(partner.id, "advocate")}>
                                Mark Advocate
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
                      {stage.label}
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
                      <p className="text-xs text-muted-foreground text-center py-4">No partners</p>
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
                <CardTitle className="text-lg">Partner Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {PIPELINE_STAGES.map(stage => {
                    const count = getStagePartners(stage.id).length
                    const total = partners.length || 1
                    return (
                      <div key={stage.id} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{stage.label}</span>
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
                <CardTitle className="text-lg">Vertical Breakdown</CardTitle>
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
                <CardTitle className="text-lg">Founder&apos;s Daily Brief</CardTitle>
                <CardDescription>Key updates from your design partner program</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">• <strong>{getStagePartners("launch").length}</strong> partner(s) ready to launch this week</p>
                <p className="text-sm">• <strong>{getStagePartners("pilot").length}</strong> active pilot(s) in progress</p>
                <p className="text-sm">• Average feedback score: <strong>{Math.round(partners.reduce((s, p) => s + p.feedbackScore, 0) / partners.length)}%</strong></p>
                <p className="text-sm">• Top vertical: <strong>{Array.from(new Set(partners.map(p => p.vertical))).sort((a, b) => partners.filter(p => p.vertical === b).length - partners.filter(p => p.vertical === a).length)[0]}</strong></p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Partner Notes — {selectedPartner?.name}</DialogTitle>
            <DialogDescription>Track feedback and touchpoints</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Current Notes</Label>
              <p className="text-sm text-muted-foreground mt-1 p-3 bg-muted rounded-md">{selectedPartner?.notes}</p>
            </div>
            <div className="space-y-2">
              <Label>Add Note</Label>
              <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>Close</Button>
            <Button onClick={() => {
              toast.success("Note added")
              setNoteText("")
              setNotesDialogOpen(false)
            }}>Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
