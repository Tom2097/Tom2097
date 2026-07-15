"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  ClipboardCheck,
  Plus,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Search,
  ArrowRight,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface CapaRecord {
  id: string
  title: string
  description: string
  source: string
  severity: string
  status: string
  created_at: string
}

const statusColors: Record<string, string> = {
  open: "bg-amber-500/20 text-amber-600",
  investigation: "bg-blue-500/20 text-blue-600",
  action: "bg-purple-500/20 text-purple-600",
  verification: "bg-cyan-500/20 text-cyan-600",
  closed: "bg-chart-2/20 text-chart-2",
}

const validNextStates: Record<string, string[]> = {
  open: ["investigation"],
  investigation: ["action", "open"],
  action: ["verification", "investigation"],
  verification: ["closed", "action"],
}

export function CapaManager() {
  const [capas, setCapas] = useState<CapaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<string>("all")
  const [newCapa, setNewCapa] = useState({ title: "", description: "", source: "quality", severity: "major" })
  const [submitting, setSubmitting] = useState(false)

  const fetchCapas = async () => {
    try {
      const res = await fetch("/api/v1/compliance/capas")
      if (res.ok) {
        const data = await res.json()
        setCapas(Array.isArray(data) ? data : [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCapas() }, [])

  const handleCreate = async () => {
    if (!newCapa.title) return
    setSubmitting(true)
    try {
      await fetch("/api/v1/compliance/capas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCapa),
      })
      setAddOpen(false)
      setNewCapa({ title: "", description: "", source: "quality", severity: "major" })
      fetchCapas()
    } finally {
      setSubmitting(false)
    }
  }

  const handleTransition = async (id: string, toStatus: string) => {
    await fetch(`/api/v1/compliance/capas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: toStatus, notes: null }),
    })
    fetchCapas()
  }

  const filtered = capas.filter(c => {
    if (filter !== "all" && c.status !== filter) return false
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <Card className="p-6 border-border/50 bg-card/50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-foreground">CAPA Management</h3>
          <p className="text-sm text-muted-foreground">Corrective and Preventive Actions</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />New CAPA</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create CAPA</DialogTitle>
              <DialogDescription>Document a corrective or preventive action</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={newCapa.title} onChange={(e) => setNewCapa(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={newCapa.description} onChange={(e) => setNewCapa(p => ({ ...p, description: e.target.value }))} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select value={newCapa.source} onValueChange={(v) => setNewCapa(p => ({ ...p, source: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quality">Quality</SelectItem>
                      <SelectItem value="safety">Safety</SelectItem>
                      <SelectItem value="compliance">Compliance</SelectItem>
                      <SelectItem value="process">Process</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select value={newCapa.severity} onValueChange={(v) => setNewCapa(p => ({ ...p, severity: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minor">Minor</SelectItem>
                      <SelectItem value="major">Major</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newCapa.title || submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search CAPAs..." className="pl-10" />
        </div>
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="investigation">Investigation</TabsTrigger>
            <TabsTrigger value="action">Action</TabsTrigger>
            <TabsTrigger value="closed">Closed</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No CAPA records found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((capa, i) => (
            <motion.div key={capa.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="p-4 rounded-lg border border-border/50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-foreground">{capa.title}</p>
                    <Badge variant="secondary" className={statusColors[capa.status]}>{capa.status}</Badge>
                    <Badge variant="outline" className="text-xs">{capa.severity}</Badge>
                  </div>
                  {capa.description && <p className="text-xs text-muted-foreground line-clamp-2">{capa.description}</p>}
                  <p className="text-xs text-muted-foreground mt-2">Created {new Date(capa.created_at).toLocaleDateString()} · {capa.source}</p>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  {validNextStates[capa.status]?.map((next) => (
                    <Button key={next} size="sm" variant="ghost" className="text-xs gap-1" onClick={() => handleTransition(capa.id, next)}>
                      {next} <ArrowRight className="w-3 h-3" />
                    </Button>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </Card>
  )
}
