"use client"

import { useState, useEffect } from "react"
import { FileText, Plus, Eye, Send, CheckCircle2, XCircle, Download, MoreHorizontal, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface QuoteContactOption {
  id: string
  first_name: string
  last_name: string
  email: string | null
}

interface QuoteCompanyOption {
  id: string
  name: string
}

interface Quote {
  id: string
  title: string
  status: string
  value: number
  currency: string
  contact: string
  company: string
  valid_until: string | null
  created_at: string
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-500",
  viewed: "bg-amber-500/10 text-amber-500",
  accepted: "bg-emerald-500/10 text-emerald-500",
  rejected: "bg-red-500/10 text-red-500",
  expired: "bg-muted text-muted-foreground",
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 0 }).format(value)
}

export function CrmQuotes() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<string>("all")

  const [contacts, setContacts] = useState<QuoteContactOption[]>([])
  const [companies, setCompanies] = useState<QuoteCompanyOption[]>([])
  const [newQuoteOpen, setNewQuoteOpen] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newContactId, setNewContactId] = useState<string>("")
  const [newCompanyId, setNewCompanyId] = useState<string>("")
  const [newValue, setNewValue] = useState("")
  const [newCurrency, setNewCurrency] = useState("USD")
  const [newValidUntil, setNewValidUntil] = useState("")
  const [newNotes, setNewNotes] = useState("")
  const [creating, setCreating] = useState(false)

  const fetchQuotes = () =>
    fetch("/api/v1/crm/quotes")
      .then((r) => r.ok ? r.json() : Promise.reject("Failed to load"))
      .then((data) => { setQuotes(data.quotes || []); setLoading(false) })
      .catch(() => { setError("Failed to load quotes"); setLoading(false) })

  useEffect(() => {
    fetchQuotes()
    fetch("/api/v1/crm/contacts?limit=100")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setContacts(data.contacts ?? []))
      .catch(() => {})
    fetch("/api/v1/crm/companies?limit=100")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setCompanies(data.companies ?? []))
      .catch(() => {})
  }, [])

  const resetNewQuoteForm = () => {
    setNewTitle("")
    setNewContactId("")
    setNewCompanyId("")
    setNewValue("")
    setNewCurrency("USD")
    setNewValidUntil("")
    setNewNotes("")
  }

  const createQuote = async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/v1/crm/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          contact_id: newContactId || null,
          company_id: newCompanyId || null,
          value: newValue ? parseFloat(newValue) : 0,
          currency: newCurrency || "USD",
          valid_until: newValidUntil || null,
          notes: newNotes || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to create quote")
      }
      await fetchQuotes()
      toast.success("Quote created")
      setNewQuoteOpen(false)
      resetNewQuoteForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create quote")
    } finally {
      setCreating(false)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/v1/crm/quotes?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      setQuotes((prev) => prev.map((q) => q.id === id ? { ...q, status } : q))
    } catch { /* ignore */ }
  }

  const filtered = filter === "all" ? quotes : quotes.filter((q) => q.status === filter)

  if (loading) return <div className="text-xs text-muted-foreground p-4 text-center">Loading quotes...</div>
  if (error) return <div className="text-xs text-red-500 p-4 text-center">{error}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border border-border/50 p-0.5 bg-secondary/30">
          {["all", "draft", "sent", "accepted", "rejected"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn("px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors", filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
            >
              {f}
            </button>
          ))}
        </div>
        <Dialog open={newQuoteOpen} onOpenChange={(open) => { setNewQuoteOpen(open); if (!open) resetNewQuoteForm() }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> New Quote</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Quote</DialogTitle>
              <DialogDescription>Create a new quote for a contact or company.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <Label htmlFor="quote-title">Title</Label>
                <Input id="quote-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Annual subscription renewal" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="quote-contact">Contact</Label>
                  <Select value={newContactId || "none"} onValueChange={(v) => setNewContactId(v === "none" ? "" : v)}>
                    <SelectTrigger id="quote-contact"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Unnamed"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quote-company">Company</Label>
                  <Select value={newCompanyId || "none"} onValueChange={(v) => setNewCompanyId(v === "none" ? "" : v)}>
                    <SelectTrigger id="quote-company"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="quote-value">Value</Label>
                  <Input id="quote-value" type="number" min="0" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quote-currency">Currency</Label>
                  <Input id="quote-currency" value={newCurrency} onChange={(e) => setNewCurrency(e.target.value.toUpperCase())} placeholder="USD" maxLength={3} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quote-valid-until">Valid until</Label>
                <Input id="quote-valid-until" type="date" value={newValidUntil} onChange={(e) => setNewValidUntil(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quote-notes">Notes</Label>
                <Textarea id="quote-notes" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={3} placeholder="Optional notes..." />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setNewQuoteOpen(false); resetNewQuoteForm() }}>Cancel</Button>
              <Button onClick={createQuote} disabled={creating || !newTitle.trim()}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Quote
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {filtered.map((quote) => (
          <Card key={quote.id} className="p-4 border-border/50 hover:border-primary/30 transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground text-sm">{quote.title}</p>
                    <Badge className={cn("text-[10px] px-1.5 h-4 capitalize font-normal", statusColors[quote.status])}>{quote.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{quote.contact} · {quote.company}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{formatCurrency(quote.value, quote.currency)}</span>
                    {quote.valid_until && <span>Valid until {new Date(quote.valid_until).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateStatus(quote.id, quote.status === "draft" ? "sent" : quote.status)}>
                  {quote.status === "draft" ? <Send className="w-3.5 h-3.5" /> : quote.status === "sent" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                  const blob = new Blob([`Title: ${quote.title}\nValue: ${formatCurrency(quote.value, quote.currency)}\nStatus: ${quote.status}\nContact: ${quote.contact}\nCompany: ${quote.company}`], { type: "text/plain" })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url; a.download = `quote-${quote.id}.txt`; a.click()
                  URL.revokeObjectURL(url)
                }}><Download className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}