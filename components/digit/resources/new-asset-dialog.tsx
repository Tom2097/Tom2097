"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Package, Loader2 } from "lucide-react"
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

const STATUSES = ["active", "maintenance", "retired", "idle"] as const

export function NewAssetDialog({ label }: { label: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", category: "", status: "active", location: "", purchase_value: "" })

  const submit = async () => {
    if (!form.name.trim()) {
      setError("Name is required")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/v1/resources/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          category: form.category || undefined,
          status: form.status,
          location: form.location || undefined,
          purchase_value: form.purchase_value ? Number(form.purchase_value) : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to create asset")
      }
      setOpen(false)
      setForm({ name: "", category: "", status: "active", location: "", purchase_value: "" })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create asset")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Package className="h-4 w-4 mr-2" />{label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Asset</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="asset-name">Name</Label>
            <Input id="asset-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Forklift #3" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="asset-category">Category</Label>
              <Input id="asset-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Equipment" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="asset-location">Location</Label>
              <Input id="asset-location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Warehouse A" />
            </div>
            <div>
              <Label htmlFor="asset-value">Purchase value</Label>
              <Input id="asset-value" type="number" value={form.purchase_value} onChange={(e) => setForm({ ...form, purchase_value: e.target.value })} placeholder="0" />
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
