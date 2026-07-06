"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Download, Trash2, FileText, ShieldCheck, AlertTriangle, CheckCircle2, Clock } from "lucide-react"

interface DsarRequest {
  id: string
  organization_id: string
  requester_email: string
  request_type: "export" | "delete" | "rectify" | "restrict"
  status: "pending" | "in_progress" | "completed" | "rejected"
  created_at: string
  completed_at: string | null
}

interface ConsentRecord {
  id: string
  purpose: string
  granted: boolean
  granted_at: string
  revoked_at: string | null
}

export default function DsarPage() {
  const [requests, setRequests] = useState<DsarRequest[]>([])
  const [consentRecords, setConsentRecords] = useState<ConsentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [exportData, setExportData] = useState<Record<string, unknown> | null>(null)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const fetchData = useCallback(async (cancelled?: { current: boolean }) => {
    try {
      setLoading(true)
      const [requestsRes, consentRes] = await Promise.all([
        fetch("/api/v1/compliance/dsar?type=requests"),
        fetch("/api/v1/compliance/dsar?type=consent"),
      ])
      const requestsData = await requestsRes.json()
      const consentData = await consentRes.json()
      if (requestsRes.ok && (!cancelled || !cancelled.current)) setRequests(requestsData.requests || [])
      if (consentRes.ok && (!cancelled || !cancelled.current)) setConsentRecords(consentData.records || [])
    } catch {
      if (!cancelled || !cancelled.current) toast.error("Failed to load DSAR data")
    } finally {
      if (!cancelled || !cancelled.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const cancelled = { current: false }
    fetchData(cancelled)
    return () => { cancelled.current = true }
  }, [fetchData])

  const handleExport = async () => {
    try {
      const res = await fetch("/api/v1/compliance/dsar?type=export")
      const data = await res.json()
      if (res.ok) {
        setExportData(data.data)
        setExportDialogOpen(true)
      }
    } catch {
      toast.error("Failed to export data")
    }
  }

  const handleDelete = async () => {
    try {
      const res = await fetch("/api/v1/compliance/dsar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete" }),
      })
      if (res.ok) {
        toast.success("Your data has been scheduled for deletion")
        setDeleteDialogOpen(false)
        fetchData()
      }
    } catch {
      toast.error("Failed to process deletion request")
    }
  }

  const createRequest = async (type: DsarRequest["request_type"]) => {
    try {
      const res = await fetch("/api/v1/compliance/dsar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", requestType: type }),
      })
      if (res.ok) {
        toast.success(`${type} request submitted`)
        fetchData()
      }
    } catch {
      toast.error("Failed to create request")
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: "secondary",
      in_progress: "default",
      completed: "outline",
      rejected: "destructive",
    }
    return <Badge variant={(variants[status] as "default" | "secondary" | "destructive" | "outline") || "secondary"}>{status}</Badge>
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "export": return <Download className="h-4 w-4" />
      case "delete": return <Trash2 className="h-4 w-4" />
      case "rectify": return <FileText className="h-4 w-4" />
      case "restrict": return <ShieldCheck className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Data Subject Access Requests</h1>
          <p className="text-muted-foreground">Manage your data privacy rights under GDPR/DPDP</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export My Data
          </Button>
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Request Deletion
          </Button>
        </div>
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">My Requests</TabsTrigger>
          <TabsTrigger value="consent">Consent Records</TabsTrigger>
          <TabsTrigger value="actions">Quick Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Your DSAR Requests</CardTitle>
              <CardDescription>Track the status of your data subject access requests</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : requests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShieldCheck className="mx-auto h-12 w-12 mb-3 opacity-50" />
                  <p>No DSAR requests yet</p>
                  <p className="text-sm">Use the buttons above to create a request</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Completed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="flex items-center gap-2">
                          {getTypeIcon(req.request_type)}
                          <span className="capitalize">{req.request_type}</span>
                        </TableCell>
                        <TableCell>{getStatusBadge(req.status)}</TableCell>
                        <TableCell className="text-sm">{new Date(req.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-sm">
                          {req.completed_at ? new Date(req.completed_at).toLocaleDateString() : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consent" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Consent Management</CardTitle>
              <CardDescription>Review and manage your data processing consents</CardDescription>
            </CardHeader>
            <CardContent>
              {consentRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No consent records found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Granted At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consentRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="capitalize">{record.purpose.replace(/_/g, " ")}</TableCell>
                        <TableCell>
                          {record.granted ? (
                            <Badge variant="outline" className="text-green-500">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Granted
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-500">
                              <AlertTriangle className="mr-1 h-3 w-3" /> Revoked
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{new Date(record.granted_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                const res = await fetch("/api/v1/compliance/dsar", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    action: "consent",
                                    revoke: record.granted,
                                    purpose: record.purpose,
                                  }),
                                })
                                if (res.ok) {
                                  toast.success(`Consent ${record.granted ? "revoked" : "granted"}`)
                                  fetchData()
                                }
                              } catch {
                                toast.error("Failed to update consent")
                              }
                            }}
                          >
                            {record.granted ? "Revoke" : "Grant"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Export My Data
                </CardTitle>
                <CardDescription>
                  Download all personal data we hold about you in a portable format
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleExport} className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Request Data Export
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Rectify Data
                </CardTitle>
                <CardDescription>
                  Request correction of inaccurate or incomplete personal data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="secondary" onClick={() => createRequest("rectify")} className="w-full">
                  Request Rectification
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Restrict Processing
                </CardTitle>
                <CardDescription>
                  Limit how we process your personal data under certain circumstances
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="secondary" onClick={() => createRequest("restrict")} className="w-full">
                  Request Restriction
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5" />
                  Right to Erasure
                </CardTitle>
                <CardDescription>
                  Request deletion of your personal data (&ldquo;right to be forgotten&rdquo;)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} className="w-full">
                  Request Deletion
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Your Exported Data</DialogTitle>
            <DialogDescription>
              This is the personal data we hold about you. Download it for your records.
            </DialogDescription>
          </DialogHeader>
          <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
            {JSON.stringify(exportData, null, 2)}
          </pre>
          <DialogFooter>
            <Button onClick={() => setExportDialogOpen(false)}>Close</Button>
            <Button
              variant="outline"
              onClick={() => {
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `personal-data-export-${new Date().toISOString().split("T")[0]}.json`
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Download JSON
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Account Deletion</DialogTitle>
            <DialogDescription>
              This will initiate the data erasure process. Your account and personal data will be permanently deleted.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-destructive/10 p-4 rounded-lg text-sm space-y-2">
            <p className="font-medium text-destructive">What will be deleted:</p>
            <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
              <li>Your profile and account information</li>
              <li>Personal data and activity logs</li>
              <li>Consent records and preferences</li>
              <li>OAuth account connections</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Request Deletion</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
