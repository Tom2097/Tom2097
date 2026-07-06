"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import {
  Shield,
  ScrollText,
  Globe,
  GlobeLock,
  Plus,
  Trash2,
  Search,
  Monitor,
  LogOut,
  Clock,
  AlertTriangle,
} from "lucide-react"

interface AuditEvent {
  id: string
  action: string
  resource_type: string
  resource_id: string
  user_id: string
  ip_address: string
  created_at: string
  metadata: Record<string, unknown>
}

interface IpAllowlistEntry {
  id: string
  cidr: string
  description: string
  created_at: string
}

interface Session {
  id: string
  user_id: string
  user_email: string
  created_at: string
  expires_at: string
  ip_address: string
  user_agent: string
}

export default function SecurityPage() {
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditSearch, setAuditSearch] = useState("")
  const [auditAction, setAuditAction] = useState("all")

  const [allowlist, setAllowlist] = useState<IpAllowlistEntry[]>([
    { id: "1", cidr: "10.0.0.0/8", description: "Corporate VPN", created_at: new Date().toISOString() },
    { id: "2", cidr: "192.168.1.0/24", description: "Office Network", created_at: new Date().toISOString() },
  ])
  const [newCidr, setNewCidr] = useState("")
  const [newDesc, setNewDesc] = useState("")

  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)

  const [allowlistEnabled, setAllowlistEnabled] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        await Promise.all([
          fetch("/api/v1/admin/audit").then(r => r.json()).then(d => { if (!cancelled) setAuditLogs(d.entries || []); }),
          fetch("/api/v1/admin/sessions").then(r => r.json()).then(d => { if (!cancelled) setSessions(d.sessions || []); }),
        ])
      } catch {
        // silent
      } finally {
        if (!cancelled) { setAuditLoading(false); setSessionsLoading(false) }
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  const loadAuditLogs = async () => {
    try {
      setAuditLoading(true)
      const res = await fetch("/api/v1/admin/audit")
      if (res.ok) {
        const data = await res.json()
        setAuditEvents(data.entries || [])
      }
    } catch {
    } finally {
      setAuditLoading(false)
    }
  }

  const loadSessions = async () => {
    try {
      const res = await fetch("/api/v1/admin/sessions")
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions || [])
      }
    } catch {
    } finally {
      setSessionsLoading(false)
    }
  }

  const filteredAudit = auditEvents.filter((e) => {
    const matchesSearch =
      e.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      e.resource_type?.toLowerCase().includes(auditSearch.toLowerCase()) ||
      e.ip_address?.toLowerCase().includes(auditSearch.toLowerCase())
    const matchesAction = auditAction === "all" || e.action === auditAction
    return matchesSearch && matchesAction
  })

  const addAllowlistEntry = () => {
    if (!newCidr) return
    const entry: IpAllowlistEntry = {
      id: `ip-${Date.now()}`,
      cidr: newCidr,
      description: newDesc,
      created_at: new Date().toISOString(),
    }
    setAllowlist([...allowlist, entry])
    setNewCidr("")
    setNewDesc("")
    toast.success("IP allowlist entry added")
  }

  const removeAllowlistEntry = (id: string) => {
    setAllowlist(allowlist.filter((e) => e.id !== id))
    toast.success("IP allowlist entry removed")
  }

  const revokeSession = async (sessionId: string) => {
    try {
      const res = await fetch("/api/v1/admin/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", sessionId }),
      })
      if (res.ok) {
        setSessions(sessions.filter((s) => s.id !== sessionId))
        toast.success("Session revoked")
      }
    } catch {
      toast.error("Failed to revoke session")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Security</h1>
          <p className="text-muted-foreground">Monitor security events and manage access controls</p>
        </div>
      </div>

      <Tabs defaultValue="audit">
        <TabsList>
          <TabsTrigger value="audit">
            <ScrollText className="mr-2 h-4 w-4" />
            Audit Log
          </TabsTrigger>
          <TabsTrigger value="allowlist">
            <GlobeLock className="mr-2 h-4 w-4" />
            IP Allowlist
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Monitor className="mr-2 h-4 w-4" />
            Sessions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search audit events..."
                    className="pl-10"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                  />
                </div>
                <Select value={auditAction} onValueChange={setAuditAction}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="INSERT">INSERT</SelectItem>
                    <SelectItem value="UPDATE">UPDATE</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <div className="py-8 text-center text-muted-foreground">Loading...</div>
              ) : filteredAudit.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <ScrollText className="mx-auto h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-4 font-medium">No audit events found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Resource ID</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAudit.slice(0, 100).map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <Badge variant={
                            event.action === "INSERT" ? "default" :
                            event.action === "UPDATE" ? "secondary" :
                            "destructive"
                          }>
                            {event.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{event.resource_type || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{event.resource_id?.slice(0, 12) || "—"}...</TableCell>
                        <TableCell className="font-mono text-xs">{event.ip_address || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(event.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allowlist" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>IP Allowlist</CardTitle>
                  <CardDescription>Restrict admin access to trusted IP ranges</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label>Enabled</Label>
                  <Switch checked={allowlistEnabled} onCheckedChange={setAllowlistEnabled} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {allowlistEnabled && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">IP allowlist is enabled</p>
                    <p className="text-muted-foreground">Only requests from allowed IP ranges can access the admin panel.</p>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="CIDR (e.g. 10.0.0.0/8)"
                  className="flex-1 font-mono"
                  value={newCidr}
                  onChange={(e) => setNewCidr(e.target.value)}
                />
                <Input
                  placeholder="Description"
                  className="w-48"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
                <Button onClick={addAllowlistEntry} disabled={!newCidr}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CIDR Range</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allowlist.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-sm">{entry.cidr}</TableCell>
                      <TableCell className="text-sm">{entry.description}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" onClick={() => removeAllowlistEntry(entry.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {allowlist.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">No allowlist entries</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>View and manage active admin sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {sessionsLoading ? (
                <div className="py-8 text-center text-muted-foreground">Loading...</div>
              ) : sessions.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Monitor className="mx-auto h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-4 font-medium">No active sessions</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="text-xs">{session.user_email}</TableCell>
                        <TableCell className="font-mono text-xs">{session.ip_address}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(session.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span>{new Date(session.expires_at).toLocaleString()}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {session.user_agent?.slice(0, 50) || "—"}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon-sm" onClick={() => revokeSession(session.id)}>
                            <LogOut className="h-4 w-4 text-destructive" />
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
      </Tabs>
    </div>
  )
}
