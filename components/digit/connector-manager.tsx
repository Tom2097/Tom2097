"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  Plug,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Mail,
  FolderOpen,
  MessageSquare,
  Globe,
  Check,
  AlertCircle,
  X
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Connector {
  id: string
  name: string
  type: string
  enabled: boolean
  connected: boolean
  oauthProvider: "google" | "microsoft" | "slack" | null
  last_sync_at: string | null
  created_at: string
}

const connectorIcons: Record<string, React.ElementType> = {
  gmail: Mail,
  google_drive: FolderOpen,
  slack: MessageSquare,
  sharepoint: FolderOpen,
  custom: Globe,
}

const connectorLabels: Record<string, string> = {
  gmail: "Gmail",
  google_drive: "Google Drive",
  slack: "Slack",
  sharepoint: "SharePoint",
  custom: "Custom API",
}

// Types with a real OAuth flow -- these get a "Connect with..." redirect
// button instead of a manual API key field.
const OAUTH_TYPES = new Set(["gmail", "google_drive", "slack", "sharepoint"])

export function ConnectorManager() {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [newConnector, setNewConnector] = useState({ name: "", type: "gmail", credentials: "" })

  const fetchConnectors = async () => {
    try {
      const res = await fetch("/api/v1/connectors")
      if (res.ok) {
        const data = await res.json()
        setConnectors(data.connectors || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchConnectors() }, [])

  const handleCreate = async () => {
    const isOAuth = OAUTH_TYPES.has(newConnector.type)
    const res = await fetch("/api/v1/connectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newConnector.name,
        type: newConnector.type,
        credentials: isOAuth ? {} : { api_key: newConnector.credentials },
      }),
    })
    if (res.ok) {
      const { connector } = await res.json()
      setAddOpen(false)
      setNewConnector({ name: "", type: "gmail", credentials: "" })
      await fetchConnectors()
      if (isOAuth && connector?.id) {
        window.location.href = `/api/v1/connectors/${connector.id}/oauth/start`
      }
    }
  }

  const handleDelete = async (id: string) => {
    await fetch("/api/v1/connectors", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    fetchConnectors()
  }

  const handleSync = async (id: string) => {
    setSyncing(id)
    await fetch(`/api/v1/connectors/${id}/sync`, { method: "POST" })
    setSyncing(null)
    fetchConnectors()
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
  }

  return (
    <Card className="p-6 border-border/50 bg-card/50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-foreground">Integrations</h3>
          <p className="text-sm text-muted-foreground">Connect your tools and data sources</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Connector
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Connector</DialogTitle>
              <DialogDescription>Connect an external service to ingest data</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Connector Type</Label>
                <Select value={newConnector.type} onValueChange={(v) => setNewConnector(p => ({ ...p, type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(connectorLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={newConnector.name} onChange={(e) => setNewConnector(p => ({ ...p, name: e.target.value }))} placeholder="My Connector" />
              </div>
              {OAUTH_TYPES.has(newConnector.type) ? (
                <p className="text-xs text-muted-foreground">
                  You&apos;ll be redirected to sign in and grant access after creating this connector -- no API key needed.
                </p>
              ) : (
                <div className="space-y-2">
                  <Label>API Key / Token</Label>
                  <Input value={newConnector.credentials} onChange={(e) => setNewConnector(p => ({ ...p, credentials: e.target.value }))} type="password" />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={!newConnector.name || (!OAUTH_TYPES.has(newConnector.type) && !newConnector.credentials)}
              >
                {OAUTH_TYPES.has(newConnector.type) ? "Continue" : "Connect"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {connectors.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Plug className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No connectors configured</p>
          <p className="text-sm mt-2">Connect Gmail, Google Drive, SharePoint, or Slack to ingest data automatically</p>
        </div>
      ) : (
        <div className="space-y-3">
          {connectors.map((connector, i) => {
            const Icon = connectorIcons[connector.type] || Plug
            return (
              <motion.div
                key={connector.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-4 rounded-lg border border-border/50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{connector.name}</p>
                      {OAUTH_TYPES.has(connector.type) ? (
                        <Badge variant={connector.connected ? "default" : "secondary"} className="text-xs">
                          {connector.connected ? "Connected" : "Not connected"}
                        </Badge>
                      ) : (
                        <Badge variant={connector.enabled ? "default" : "secondary"} className="text-xs">
                          {connector.enabled ? "Active" : "Disabled"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {connectorLabels[connector.type] || connector.type}
                      {connector.last_sync_at && ` · Last synced ${new Date(connector.last_sync_at).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {OAUTH_TYPES.has(connector.type) && !connector.connected ? (
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/api/v1/connectors/${connector.id}/oauth/start`}>Connect</a>
                    </Button>
                  ) : (
                    <Button size="icon" variant="ghost" onClick={() => handleSync(connector.id)} disabled={syncing === connector.id}>
                      {syncing === connector.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(connector.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
