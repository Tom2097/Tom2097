"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useI18n } from "@/components/providers/i18n-provider"
import { UserPlus, Mail, Phone, MoreHorizontal, Trash2, Pencil, Users, Search, Loader2 } from "lucide-react"
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
import { CONTACT_STATUSES } from "@/lib/crm/types"
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
  const { t } = useI18n()
  const router = useRouter()
  const [contacts, setContacts] = useState(initialContacts)
  const [searchQuery, setSearchQuery] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [editContact, setEditContact] = useState<CrmContactRow | null>(null)
  const [statusFilter, setStatusFilter] = useState("all")
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
    if (q && !c.name.toLowerCase().includes(q) && !(c.company ?? "").toLowerCase().includes(q) && !(c.email ?? "").toLowerCase().includes(q)) return false
    if (statusFilter !== "all" && c.status !== statusFilter) return false
    return true
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
        throw new Error(data.error || t("crm.contactsManager.error"))
      }

      const contact = await res.json()
      setContacts((prev) => [
        {
          id: contact.id,
          name: [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() || contact.email || t("crm.contactsManager.unnamedContact"),
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
      // The CRM Intelligence counters above are server-rendered; without
      // this they kept showing the old totals until a full reload.
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("crm.contactsManager.error"))
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
        throw new Error(data.error || t("crm.contactsManager.error"))
      }

      const contact = await res.json()
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contact.id
            ? {
                ...c,
                name: [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() || contact.email || t("crm.contactsManager.unnamedContact"),
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
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("crm.contactsManager.error"))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t("crm.contactsManager.deleteConfirm"))) return

    try {
      const res = await fetch(`/api/v1/crm/contacts?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete contact")
      setContacts((prev) => prev.filter((c) => c.id !== id))
      router.refresh()
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
            {t("crm.contactsManager.addLead")}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("crm.contactsManager.addContactTitle")}</DialogTitle>
            <DialogDescription>{t("crm.contactsManager.addContactDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd}>
            <div className="grid gap-4 py-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-first-name">{t("crm.contactsManager.firstName")}</Label>
                  <Input id="add-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t("crm.contactsManager.firstNamePlaceholder")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-last-name">{t("crm.contactsManager.lastName")}</Label>
                  <Input id="add-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t("crm.contactsManager.lastNamePlaceholder")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-email">{t("crm.contactsManager.email")}</Label>
                <Input id="add-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("crm.contactsManager.emailPlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-phone">{t("crm.contactsManager.phone")}</Label>
                <Input id="add-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("crm.contactsManager.phonePlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-title">{t("crm.contactsManager.title")}</Label>
                <Input id="add-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("crm.contactsManager.titlePlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-status">{t("crm.contactsManager.status")}</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">{t("crm.contactsManager.statusOptions.lead")}</SelectItem>
                    <SelectItem value="active">{t("crm.contactsManager.statusOptions.active")}</SelectItem>
                    <SelectItem value="inactive">{t("crm.contactsManager.statusOptions.inactive")}</SelectItem>
                    <SelectItem value="archived">{t("crm.contactsManager.statusOptions.archived")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setAddOpen(false); resetForm() }}>{t("crm.contactsManager.cancel")}</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("crm.contactsManager.addContact")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editContact} onOpenChange={(open) => { if (!open) setEditContact(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("crm.contactsManager.editContactTitle")}</DialogTitle>
            <DialogDescription>{t("crm.contactsManager.editContactDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            <div className="grid gap-4 py-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-first-name">{t("crm.contactsManager.firstName")}</Label>
                  <Input id="edit-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t("crm.contactsManager.firstNamePlaceholder")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-last-name">{t("crm.contactsManager.lastName")}</Label>
                  <Input id="edit-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t("crm.contactsManager.lastNamePlaceholder")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">{t("crm.contactsManager.email")}</Label>
                <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("crm.contactsManager.emailPlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">{t("crm.contactsManager.phone")}</Label>
                <Input id="edit-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("crm.contactsManager.phonePlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-title">{t("crm.contactsManager.title")}</Label>
                <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("crm.contactsManager.titlePlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">{t("crm.contactsManager.status")}</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">{t("crm.contactsManager.statusOptions.lead")}</SelectItem>
                    <SelectItem value="active">{t("crm.contactsManager.statusOptions.active")}</SelectItem>
                    <SelectItem value="inactive">{t("crm.contactsManager.statusOptions.inactive")}</SelectItem>
                    <SelectItem value="archived">{t("crm.contactsManager.statusOptions.archived")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setEditContact(null); resetForm() }}>{t("crm.contactsManager.cancel")}</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("crm.contactsManager.saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Contacts Table */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold text-foreground">{t("crm.contactsManager.contacts")}</h3>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("crm.contactsManager.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 pl-10"
              />
            </div>
            {/* Was an icon button that silently cycled the status filter on
                each click with no indication of which status was active. */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36" aria-label={t("crm.contactsManager.filterAriaLabel")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("crm.contactsManager.allStatuses")}</SelectItem>
                {CONTACT_STATUSES.map((st) => (
                  <SelectItem key={st} value={st}>{t(`crm.contactsManager.statusOptions.${st}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/50 text-muted-foreground">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium text-foreground">{t("crm.contactsManager.noContactsTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("crm.contactsManager.noContactsDescription")}</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="pb-3 text-left text-sm font-medium text-muted-foreground">{t("crm.contactsManager.table.name")}</th>
                  <th className="pb-3 text-left text-sm font-medium text-muted-foreground">{t("crm.contactsManager.table.company")}</th>
                  <th className="pb-3 text-left text-sm font-medium text-muted-foreground">{t("crm.contactsManager.table.title")}</th>
                  <th className="pb-3 text-left text-sm font-medium text-muted-foreground">{t("crm.contactsManager.table.status")}</th>
                  <th className="pb-3 text-right text-sm font-medium text-muted-foreground">{t("crm.contactsManager.table.actions")}</th>
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
                        {t(`crm.contactsManager.statusOptions.${contact.status}`)}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex justify-end gap-1">
                        {/* Only when present -- these used to render
                            mailto:null / tel:null links for contacts with no
                            email or phone. */}
                        {contact.email && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("crm.contactsManager.emailContact")} asChild>
                            <a href={`mailto:${contact.email}`}>
                              <Mail className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {contact.phone && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("crm.contactsManager.callContact")} asChild>
                            <a href={`tel:${contact.phone}`}>
                              <Phone className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("crm.contactsManager.moreActions")}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(contact)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              {t("crm.contactsManager.edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(contact.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t("crm.contactsManager.delete")}
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
                      {searchQuery.trim() ? t("crm.contactsManager.noMatches", { searchQuery }) : t("crm.contactsManager.noStatusMatches")}
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


