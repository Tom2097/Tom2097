"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { AlertTriangle, AlertCircle, Shield, BookOpen, Plus, UserCheck, ArrowUpCircle, CheckCircle2 } from "lucide-react"
import type { Incident, Runbook } from "@/lib/incident/response"
import { DEFAULT_RUNBOOKS } from "@/lib/incident/response"

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [runbookDialogOpen, setRunbookDialogOpen] = useState(false)
  const [selectedRunbook, setSelectedRunbook] = useState<Runbook | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [formTitle, setFormTitle] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formSeverity, setFormSeverity] = useState<Incident["severity"]>("medium")

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const res = await fetch("/api/v1/admin/incidents")
        const data = await res.json()
        if (res.ok && !cancelled) setIncidents(data.incidents || [])
      } catch {
        if (!cancelled) {
          try {
            const { getIncidents } = await import("@/lib/incident/response")
            const data = await getIncidents("default")
            if (!cancelled) setIncidents(data)
          } catch {
            toast.error("Failed to load incidents")
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/incidents")
      const data = await res.json()
      if (res.ok) setIncidents(data.incidents || [])
    } catch {
      toast.error("Failed to refresh incidents")
    }
  }, [])

  const handleReportIncident = async () => {
    if (!formTitle) {
      toast.error("Please provide an incident title")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/v1/admin/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "report", title: formTitle, description: formDescription, severity: formSeverity }),
      })
      if (res.ok) {
        toast.success("Incident reported")
        setReportDialogOpen(false)
        setFormTitle("")
        setFormDescription("")
        setFormSeverity("medium")
        fetchIncidents()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to report incident")
      }
    } catch {
      toast.error("Failed to report incident")
    } finally {
      setSubmitting(false)
    }
  }

  const handleQuickAction = async (incidentId: string, action: "assign" | "escalate" | "resolve") => {
    try {
      const res = await fetch("/api/v1/admin/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, incidentId }),
      })
      if (res.ok) {
        toast.success(`Incident ${action}d`)
        fetchIncidents()
      } else {
        const data = await res.json()
        toast.error(data.error || `Failed to ${action} incident`)
      }
    } catch {
      toast.error(`Failed to ${action} incident`)
    }
  }

  const getSeverityIcon = (severity: Incident["severity"]) => {
    switch (severity) {
      case "critical": return <AlertTriangle className="h-4 w-4 text-red-500" />
      case "high": return <AlertCircle className="h-4 w-4 text-orange-500" />
      case "medium": return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case "low": return <AlertCircle className="h-4 w-4 text-blue-500" />
    }
  }

  const getSeverityBadge = (severity: Incident["severity"]) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      critical: "destructive",
      high: "destructive",
      medium: "secondary",
      low: "outline",
    }
    return <Badge variant={map[severity]}>{severity}</Badge>
  }

  const getStatusBadge = (status: Incident["status"]) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      detected: "destructive",
      investigating: "secondary",
      mitigated: "outline",
      resolved: "default",
    }
    return <Badge variant={map[status]}>{status}</Badge>
  }

  const severityCounts = {
    critical: incidents.filter(i => i.severity === "critical" && i.status !== "resolved").length,
    high: incidents.filter(i => i.severity === "high" && i.status !== "resolved").length,
    medium: incidents.filter(i => i.severity === "medium" && i.status !== "resolved").length,
    low: incidents.filter(i => i.severity === "low" && i.status !== "resolved").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Incident Response</h1>
          <p className="text-muted-foreground">Manage and respond to security and operational incidents</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={runbookDialogOpen} onOpenChange={setRunbookDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <BookOpen className="mr-2 h-4 w-4" />
                Runbooks
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Runbook Library</DialogTitle>
                <DialogDescription>Pre-defined response procedures for common incident types</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {DEFAULT_RUNBOOKS.map((rb) => (
                  <Card key={rb.id} className={`cursor-pointer transition-colors ${selectedRunbook?.id === rb.id ? "border-primary" : ""}`} onClick={() => setSelectedRunbook(selectedRunbook?.id === rb.id ? null : rb)}>
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{rb.title}</CardTitle>
                        <Badge variant="outline">{rb.category}</Badge>
                      </div>
                      <CardDescription className="text-xs">{rb.description}</CardDescription>
                    </CardHeader>
                    {selectedRunbook?.id === rb.id && (
                      <CardContent className="p-4 pt-2">
                        <ol className="space-y-2">
                          {rb.steps.map((step) => (
                            <li key={step.order} className="text-sm border-l-2 border-primary pl-3 py-1">
                              <p className="font-medium">Step {step.order}: {step.action}</p>
                              <p className="text-xs text-muted-foreground">Expected: {step.expectedOutcome}</p>
                            </li>
                          ))}
                        </ol>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Report Incident
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Report New Incident</DialogTitle>
                <DialogDescription>Document a security or operational incident for tracking and response</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="e.g., Unauthorized API access detected" />
                </div>
                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select value={formSeverity} onValueChange={(v) => setFormSeverity(v as Incident["severity"])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Describe the incident, affected systems, and initial findings" rows={4} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReportDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleReportIncident} disabled={submitting}>
                  {submitting ? "Reporting..." : "Report Incident"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {(["critical", "high", "medium", "low"] as const).map((sev) => (
          <Card key={sev}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium capitalize">{sev}</CardTitle>
              {getSeverityIcon(sev)}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{severityCounts[sev]}</div>
              <p className="text-xs text-muted-foreground">Active incidents</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Incidents</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>
        {["all", "active", "resolved"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardHeader>
                <CardTitle>{tab === "all" ? "All" : tab === "active" ? "Active" : "Resolved"} Incidents</CardTitle>
                <CardDescription>
                  {tab === "all" ? "Complete incident log" : tab === "active" ? "Incidents requiring action" : "Closed incidents"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Detected</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incidents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">No incidents found</TableCell>
                        </TableRow>
                      ) : (
                        incidents
                          .filter(i => tab === "all" || (tab === "active" ? i.status !== "resolved" : i.status === "resolved"))
                          .map((inc) => (
                            <TableRow key={inc.id}>
                              <TableCell className="font-medium max-w-[250px] truncate">
                                <div className="flex items-center gap-2">
                                  {getSeverityIcon(inc.severity)}
                                  {inc.title}
                                </div>
                              </TableCell>
                              <TableCell>{getSeverityBadge(inc.severity)}</TableCell>
                              <TableCell>{getStatusBadge(inc.status)}</TableCell>
                              <TableCell className="text-sm">{inc.assignedTo || <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                              <TableCell className="text-xs">{new Date(inc.detectedAt).toLocaleString()}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {inc.status !== "resolved" && (
                                    <>
                                      <Button size="sm" variant="outline" onClick={() => handleQuickAction(inc.id, "assign")} title="Assign to me">
                                        <UserCheck className="h-3 w-3" />
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => handleQuickAction(inc.id, "escalate")} title="Escalate">
                                        <ArrowUpCircle className="h-3 w-3" />
                                      </Button>
                                      <Button size="sm" variant="default" onClick={() => handleQuickAction(inc.id, "resolve")} title="Resolve">
                                        <CheckCircle2 className="h-3 w-3" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Security Policies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{"\u2022"} Critical incidents require <strong>immediate</strong> escalation to the security team</p>
          <p>{"\u2022"} All incidents must have a documented <strong>root cause analysis</strong> within 5 business days</p>
          <p>{"\u2022"} Incident response actions are <strong>audit-logged</strong> with full traceability</p>
          <p>{"\u2022"} Follow the relevant <strong>runbook</strong> for structured response procedures</p>
          <p>{"\u2022"} Regulatory notification must occur within <strong>72 hours</strong> for data breaches</p>
        </CardContent>
      </Card>
    </div>
  )
}
