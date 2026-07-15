"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { ShieldCheck, Plus, Loader2, ListChecks } from "lucide-react"
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

interface Framework {
  id: string
  name: string
  description: string | null
  controls_count: number
  created_at: string
}

export function ComplianceFrameworks() {
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [newFramework, setNewFramework] = useState({ name: "", description: "", controls_count: 0 })
  const [submitting, setSubmitting] = useState(false)

  const fetchFrameworks = async () => {
    try {
      const res = await fetch("/api/v1/compliance/frameworks")
      if (res.ok) {
        const data = await res.json()
        setFrameworks(Array.isArray(data) ? data : [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchFrameworks() }, [])

  const handleCreate = async () => {
    if (!newFramework.name.trim()) return
    setSubmitting(true)
    try {
      await fetch("/api/v1/compliance/frameworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFramework),
      })
      setAddOpen(false)
      setNewFramework({ name: "", description: "", controls_count: 0 })
      fetchFrameworks()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-6 border-border/50 bg-card/50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-foreground">Compliance Frameworks</h3>
          <p className="text-sm text-muted-foreground">Regulatory and quality frameworks tracked for this organization</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Framework</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Compliance Framework</DialogTitle>
              <DialogDescription>Track a regulatory or quality framework (e.g. ISO 27001, GDPR, SOC 2)</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newFramework.name}
                  onChange={(e) => setNewFramework((p) => ({ ...p, name: e.target.value }))}
                  placeholder="ISO 27001"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newFramework.description}
                  onChange={(e) => setNewFramework((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  placeholder="What this framework covers"
                />
              </div>
              <div className="space-y-2">
                <Label>Total Controls</Label>
                <Input
                  type="number"
                  min={0}
                  value={newFramework.controls_count}
                  onChange={(e) => setNewFramework((p) => ({ ...p, controls_count: Math.max(0, Number(e.target.value)) }))}
                />
                <p className="text-xs text-muted-foreground">Used to weight the compliance score as evidence is submitted</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newFramework.name.trim() || submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : frameworks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No frameworks tracked yet</p>
          <p className="text-sm mt-1">Add one to start measuring compliance against it</p>
        </div>
      ) : (
        <div className="space-y-3">
          {frameworks.map((fw, i) => (
            <motion.div
              key={fw.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between p-4 rounded-lg border border-border/50"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{fw.name}</p>
                {fw.description && <p className="text-xs text-muted-foreground mt-0.5">{fw.description}</p>}
              </div>
              <Badge variant="secondary" className="gap-1">
                <ListChecks className="w-3 h-3" />{fw.controls_count} controls
              </Badge>
            </motion.div>
          ))}
        </div>
      )}
    </Card>
  )
}
