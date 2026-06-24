"use client"

import { useState } from "react"
import { UserPlus, Mail, Phone, MoreHorizontal, Trash2, Pencil, Users, Search, Filter, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface CrmContactRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  title: string | null
  status: string
  company: string | null
}

const STATUS_STYLES: Record<string, string> = {
  lead: 'bg-amber-500/10 text-amber-500',
  active: 'bg-emerald-500/10 text-emerald-500',
  inactive: 'bg-muted text-muted-foreground',
  archived: 'bg-muted text-muted-foreground',
}

interface CrmContactsManagerProps {
  initialContacts: CrmContactRow[]
}

export function CrmContactsManager({ initialContacts }: CrmContactsManagerProps) {
  const [contacts, setContacts] = useState(initialContacts)
  const [searchQuery, setSearchQuery] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [editContact, setEditContact] = useState<CrmContactRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [title, setTitle] = useState("")
  const [status, setStatus] = useState("lead")

  const filtered = contacts.filter((c) => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    return (
      c.name.toLowerCase().includes(q) ||
      (c.company ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    )
  })

  const resetForm = () => {
    setFirstName("")
    setLastName("")
    setEmail("")
    setPhone("")
    setTitle("")
    setStatus("lead")
    setError(null)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/v1/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: email || null,
          phone: phone || null,
          title: title || null,
          status,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create contact")
      }

      const contact = await res.json()
      setContacts((prev) => [
        {
          id: contact.id,
          name: [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() || contact.email || "Unnamed contact",
          email: contact.email,
          phone: contact.phone,
          title: contact.title,
          status: contact.status,
          company: null,
        },
        ...prev,
      ])

      setAddOpen(false)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editContact) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/v1/crm/contacts?id=${editContact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: email || null,
          phone: phone || null,
          title: title || null,
          status,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to update contact")
      }

      const contact = await res.json()
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contact.id
            ? {
                ...c,
                name: [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() || contact.email || "Unnamed contact",
                email: contact.email,
                phone: contact.phone,
                title: contact.title,
                status: contact.status,
              }
            : c,
        ),
      )

      setEditContact(null)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) return

    try {
      const res = await fetch(`/api/v1/crm/contacts?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete contact")
      setContacts((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      console.error("[crm] delete error:", err)
    }
  }

  const openEdit = (contact: CrmContactRow) => {
    const nameParts = contact.name.split(" ")
    setFirstName(nameParts[0] || "")
    setLastName(nameParts.slice(1).join(" ") || "")
    setEmail(contact.email ?? "")
    setPhone(contact.phone ?? "")
    setTitle(contact.title ?? "")
    setStatus(contact.status)
    setEditContact(contact)
    setError(null)
  }

  return (
    <>
      {/* Add Lead Button */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add Lead
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>Add a new contact to your CRM.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd}>
            <div className="grid gap-4 py-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-first-name">First name</Label>
                  <Input id="add-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-last-name">Last name</Label>
                  <Input id="add-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-email">Email</Label>
                <Input id="add-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@company.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-phone">Phone</Label>
                <Input id="add-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-title">Title</Label>
                <Input id="add-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Software Engineer" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setAddOpen(false); resetForm() }}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Contact
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editContact} onOpenChange={(open) => { if (!open) setEditContact(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>Update contact information.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            <div className="grid gap-4 py-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-first-name">First name</Label>
                  <Input id="edit-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-last-name">Last name</Label>
                  <Input id="edit-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@company.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input id="edit-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Software Engineer" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setEditContact(null); resetForm() }}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Contacts Table */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold text-foreground">Contacts</h3>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 pl-10"
              />
            </div>
            <Button variant="outline" size="icon" aria-label="Filter contacts">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/50 text-muted-foreground">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium text-foreground">No contacts yet</p>
              <p className="text-sm text-muted-foreground">Add your first contact to start tracking relationships.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Name</th>
                  <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Company</th>
                  <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Title</th>
                  <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                  <th className="pb-3 text-right text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((contact) => (
                  <tr key={contact.id} className="hover:bg-secondary/30">
                    <td className="py-4">
                      <p className="font-medium text-foreground">{contact.name}</p>
                      {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
                    </td>
                    <td className="py-4 text-sm text-foreground">{contact.company ?? '—'}</td>
                    <td className="py-4 text-sm text-muted-foreground">{contact.title ?? '—'}</td>
                    <td className="py-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          STATUS_STYLES[contact.status] ?? 'bg-primary/10 text-primary'
                        }`}
                      >
                        {contact.status}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Email contact" asChild>
                          <a href={`mailto:${contact.email}`}>
                            <Mail className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Call contact" asChild>
                          <a href={`tel:${contact.phone}`}>
                            <Phone className="h-4 w-4" />
                          </a>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(contact)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(contact.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      No contacts match &quot;{searchQuery}&quot;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}


