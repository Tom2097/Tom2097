"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface KeyResult {
  id: string
  objective_id: string
  name: string
  metric: string
  target: number
  current: number
  unit: string
  weight: number
}

interface KeyResultsPanelProps {
  objectiveId: string
  addLabel?: string
}

/** Compact expandable section: view/add key results and update their current value. */
export function KeyResultsPanel({ objectiveId, addLabel = "Add key result" }: KeyResultsPanelProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [keyResults, setKeyResults] = useState<KeyResult[]>([])
  const [error, setError] = useState<string | null>(null)

  const [showAddForm, setShowAddForm] = useState(false)
  const [newKr, setNewKr] = useState({ name: "", target: "", unit: "" })
  const [saving, setSaving] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/okr/objectives/${objectiveId}/key-results`)
      if (!res.ok) throw new Error("Failed to load key results")
      const data = await res.json()
      setKeyResults(data.keyResults ?? [])
      setLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load key results")
    } finally {
      setLoading(false)
    }
  }

  const toggle = (next: boolean) => {
    setOpen(next)
    if (next && !loaded) load()
  }

  const addKeyResult = async () => {
    const target = Number(newKr.target)
    if (!newKr.name.trim() || !Number.isFinite(target) || target <= 0) {
      setError("Name and a positive target are required")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/okr/objectives/${objectiveId}/key-results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKr.name.trim(), target, unit: newKr.unit.trim() || undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to add key result")
      }
      setNewKr({ name: "", target: "", unit: "" })
      setShowAddForm(false)
      await load()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add key result")
    } finally {
      setSaving(false)
    }
  }

  const updateValue = async (krId: string) => {
    const raw = drafts[krId]
    const currentValue = Number(raw)
    if (!Number.isFinite(currentValue)) {
      setError("Enter a valid number")
      return
    }
    setUpdatingId(krId)
    setError(null)
    try {
      const res = await fetch(`/api/v1/okr/objectives/${objectiveId}/key-results`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyResultId: krId, currentValue }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to update key result")
      }
      await load()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update key result")
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <Collapsible open={open} onOpenChange={toggle} className="mt-2">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
          Key results
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading...
          </div>
        )}

        {!loading && loaded && keyResults.length === 0 && (
          <p className="text-xs text-muted-foreground">No key results yet.</p>
        )}

        {!loading &&
          keyResults.map((kr) => {
            const pct = kr.target > 0 ? Math.min(100, Math.round((kr.current / kr.target) * 100)) : 0
            return (
              <div key={kr.id} className="rounded-lg bg-background/60 border border-border/40 p-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium truncate">{kr.name}</span>
                  <span className="text-muted-foreground shrink-0 ml-2">
                    {kr.current}/{kr.target} {kr.unit} ({pct}%)
                  </span>
                </div>
                <div className="w-full h-1 bg-secondary rounded-full overflow-hidden mb-2">
                  <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="New current value"
                    value={drafts[kr.id] ?? ""}
                    onChange={(e) => setDrafts({ ...drafts, [kr.id]: e.target.value })}
                    className="h-7 text-xs"
                  />
                  <Button size="sm" className="h-7 text-xs" disabled={updatingId === kr.id} onClick={() => updateValue(kr.id)}>
                    {updatingId === kr.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Update"}
                  </Button>
                </div>
              </div>
            )
          })}

        {showAddForm ? (
          <div className="rounded-lg bg-background/60 border border-border/40 p-2 space-y-2">
            <Input placeholder="Key result name" value={newKr.name} onChange={(e) => setNewKr({ ...newKr, name: e.target.value })} className="h-7 text-xs" />
            <div className="flex gap-2">
              <Input type="number" placeholder="Target" value={newKr.target} onChange={(e) => setNewKr({ ...newKr, target: e.target.value })} className="h-7 text-xs" />
              <Input placeholder="Unit (optional)" value={newKr.unit} onChange={(e) => setNewKr({ ...newKr, unit: e.target.value })} className="h-7 text-xs" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" disabled={saving} onClick={addKeyResult}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAddForm(true)}>
            <Plus className="h-3 w-3 mr-1" />{addLabel}
          </Button>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </CollapsibleContent>
    </Collapsible>
  )
}
