"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Wrench, Loader2 } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface AssetOption {
  id: string
  name: string
}

export function ScheduleMaintenanceDialog({ label, assets }: { label: string; assets: AssetOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ resource_id: "", title: "", start_time: "", end_time: "" })

  const submit = async () => {
    if (!form.resource_id || !form.title.trim() || !form.start_time || !form.end_time) {
      setError("Asset, title, start time, and end time are all required")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/v1/resources/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource_id: form.resource_id,
          resource_type: "asset",
          title: form.title,
          start_time: new Date(form.start_time).toISOString(),
          end_time: new Date(form.end_time).toISOString(),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to schedule maintenance")
      }
      setOpen(false)
      setForm({ resource_id: "", title: "", start_time: "", end_time: "" })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule maintenance")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Wrench className="h-4 w-4 mr-2" />{label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Maintenance</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Asset</Label>
            <Select value={form.resource_id} onValueChange={(v) => setForm({ ...form, resource_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select an asset" /></SelectTrigger>
              <SelectContent>
                {assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="sched-title">Description</Label>
            <Input id="sched-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Routine inspection" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sched-start">Start</Label>
              <Input id="sched-start" type="datetime-local" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="sched-end">End</Label>
              <Input id="sched-end" type="datetime-local" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
