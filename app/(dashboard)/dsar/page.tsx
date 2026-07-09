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
import { useI18n } from "@/components/providers/i18n-provider"

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
  const { t } = useI18n()
  const [requests, setRequests] = useState<DsarRequest[]>([])
  const [consentRecords, setConsentRecords] = useState<ConsentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [exportData, setExportData] = useState<Record<string, unknown> | null>(null)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const fetchData = useCallback(async (cancelled?: { current: boolean }) => {
    try {
      setLoading(true);
      const [requestsRes, consentRes] = await Promise.all([
        fetch("/api/v1/compliance/dsar?type=requests"),
        fetch("/api/v1/compliance/dsar?type=consent"),
      ]);
      
      if (cancelled?.current) return;
      
      if (!requestsRes.ok || !consentRes.ok) {
        const errorData1 = await requestsRes.json();
        const errorData2 = await consentRes.json();
        throw new Error(
          errorData1.error || errorData2.error || t('dsar.page.errors.loadFailed')
        );
      }
      
      const requestsData = await requestsRes.json();
      const consentData = await consentRes.json();
      
      if (!cancelled?.current) {
        setRequests(requestsData.requests || []);
        setConsentRecords(consentData.records || []);
      }
    } catch (error) {
      if (!cancelled?.current) {
        toast.error(error instanceof Error ? error.message : t('dsar.page.errors.loadFailed'));
      }
    } finally {
      if (!cancelled?.current) {
        setLoading(false);
      }
    }
  }, [t]);

  useEffect(() => {
    const cancelled = { current: false };
    const load = async () => {
      setLoading(true);
      try {
        await fetchData(cancelled);
      } finally {
        if (!cancelled.current) setLoading(false);
      }
    };
    load();
    return () => { cancelled.current = true; };
  }, [fetchData]);

  const handleExport = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/compliance/dsar?type=export");
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || t('dsar.page.errors.exportFailed'));
      }
      
      const data = await res.json();
      setExportData(data.data);
      setExportDialogOpen(true);
    } catch (error) {
       toast.error(error instanceof Error ? error.message : t('dsar.page.errors.exportFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/compliance/dsar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete" }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || t('dsar.page.errors.deleteFailed'));
      }
      
      toast.success(t('dsar.page.success.exportScheduled'));
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error) {
       toast.error(error instanceof Error ? error.message : t('dsar.page.errors.deleteFailed'));
    } finally {
      setLoading(false);
    }
  };

  const createRequest = async (type: DsarRequest["request_type"]) => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/compliance/dsar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", requestType: type }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || t('dsar.page.errors.createFailed'));
      }
      
      toast.success(t('dsar.page.success.requestSubmitted', { type }));
      fetchData();
    } catch (error) {
       toast.error(error instanceof Error ? error.message : t('dsar.page.errors.createFailed'));
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-2xl font-bold">{t('dsar.page.title')}</h1>
          <p className="text-muted-foreground">{t('dsar.page.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            {t('dsar.page.exportMyData')}
          </Button>
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            {t('dsar.page.requestDeletion')}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">{t('dsar.page.tabs.requests')}</TabsTrigger>
          <TabsTrigger value="consent">{t('dsar.page.tabs.consent')}</TabsTrigger>
          <TabsTrigger value="actions">{t('dsar.page.tabs.quickActions')}</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('dsar.page.yourRequests')}</CardTitle>
              <CardDescription>{t('dsar.page.trackRequests')}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
              ) : requests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShieldCheck className="mx-auto h-12 w-12 mb-3 opacity-50" />
                  <p>{t('dsar.page.noDsar')}</p>
                  <p className="text-sm">{t('dsar.page.createRequestHint')}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('dsar.page.type')}</TableHead>
                      <TableHead>{t('dsar.page.status')}</TableHead>
                      <TableHead>{t('dsar.page.requested')}</TableHead>
                      <TableHead>{t('dsar.page.completed')}</TableHead>
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
              <CardTitle>{t('dsar.page.consentManagement')}</CardTitle>
              <CardDescription>{t('dsar.page.reviewConsents')}</CardDescription>
            </CardHeader>
            <CardContent>
              {consentRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>{t('dsar.page.noConsent')}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('dsar.page.purpose')}</TableHead>
                      <TableHead>{t('dsar.page.status')}</TableHead>
                      <TableHead>{t('dsar.page.grantedAt')}</TableHead>
                      <TableHead>{t('dsar.page.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consentRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="capitalize">{record.purpose.replace(/_/g, " ")}</TableCell>
                        <TableCell>
                          {record.granted ? (
                            <Badge variant="outline" className="text-green-500">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> {t('dsar.page.granted')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-500">
                              <AlertTriangle className="mr-1 h-3 w-3" /> {t('dsar.page.revoked')}
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
                                  toast.success(t('dsar.page.success.consentUpdated', { action: record.granted ? t('dsar.page.revoked') : t('dsar.page.granted') }))
                                  fetchData()
                                }
                              } catch (error) {
                                 toast.error(error instanceof Error ? error.message : t('dsar.page.errors.updateConsentFailed'))
                              }
                            }}
                          >
                            {record.granted ? t('dsar.page.revoke') : t('dsar.page.grant')}
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
                  {t('dsar.page.exportData')}
                </CardTitle>
                <CardDescription>
                  {t('dsar.page.exportDataDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleExport} className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  {t('dsar.page.requestDataExport')}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t('dsar.page.rectifyData')}
                </CardTitle>
                <CardDescription>
                  {t('dsar.page.rectifyDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="secondary" onClick={() => createRequest("rectify")} className="w-full">
                  {t('dsar.page.requestRectification')}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  {t('dsar.page.restrictProcessing')}
                </CardTitle>
                <CardDescription>
                  {t('dsar.page.restrictDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="secondary" onClick={() => createRequest("restrict")} className="w-full">
                  {t('dsar.page.requestRestriction')}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5" />
                  {t('dsar.page.rightToErasure')}
                </CardTitle>
                <CardDescription>
                  {t('dsar.page.erasureDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} className="w-full">
                  {t('dsar.page.requestDeletionBtn')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('dsar.page.yourExportedData')}</DialogTitle>
            <DialogDescription>
              {t('dsar.page.exportDescription')}
            </DialogDescription>
          </DialogHeader>
          <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
            {JSON.stringify(exportData, null, 2)}
          </pre>
          <DialogFooter>
            <Button onClick={() => setExportDialogOpen(false)}>{t('dsar.page.cancel')}</Button>
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
              {t('dsar.page.downloadJson')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dsar.page.requestAccountDeletion')}</DialogTitle>
            <DialogDescription>
              {t('dsar.page.deletionWarning')}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-destructive/10 p-4 rounded-lg text-sm space-y-2">
            <p className="font-medium text-destructive">{t('dsar.page.whatWillBeDeleted')}</p>
            <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
              <li>{t('dsar.page.profileInfo')}</li>
              <li>{t('dsar.page.personalData')}</li>
              <li>{t('dsar.page.consentRecords')}</li>
              <li>{t('dsar.page.oauthConnections')}</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>{t('dsar.page.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t('dsar.page.requestDeletionBtn')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
