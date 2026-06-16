'use client'

import { useMemo, useState } from 'react'
import { Mail, Phone, MoreHorizontal, Search, Filter, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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

export function CrmContactsTable({ contacts }: { contacts: CrmContactRow[] }) {
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.company ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q),
    )
  }, [contacts, searchQuery])

  return (
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
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Email contact">
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Call contact">
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
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
  )
}
