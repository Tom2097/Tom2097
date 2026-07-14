"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Target, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function NewObjectiveDialog({ label }: { label: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", category: "", owner: "", start_date: "", end_date: "" })

  const submit = async () => {
    if (!form.name.trim() || !form.start_date || !form.end_date) {
      setError("Name, start date, and end date are required")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/v1/okr/objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to create objective")
      }
      setOpen(false)
      setForm({ name: "", category: "", owner: "", start_date: "", end_date: "" })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create objective")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Target className="h-4 w-4 mr-2" />{label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Objective</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="obj-name">Name</Label>
            <Input id="obj-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Increase quarterly revenue" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="obj-category">Category</Label>
              <Input id="obj-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Revenue" />
            </div>
            <div>
              <Label htmlFor="obj-owner">Owner</Label>
              <Input id="obj-owner" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="Team or person" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="obj-start">Start date</Label>
              <Input id="obj-start" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="obj-end">End date</Label>
              <Input id="obj-end" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
