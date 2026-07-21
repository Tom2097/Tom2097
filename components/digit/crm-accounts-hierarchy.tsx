"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Building2, Users, Plus, ChevronRight, ChevronDown, Building, Search, Mail, Phone, Loader2, X } from "lucide-react"

interface AccountContact {
  id: string; name: string; email: string | null; phone: string | null; title: string | null
}

interface AccountNode {
  id: string; name: string; domain: string | null; industry: string | null
  contacts: AccountContact[]; children?: AccountNode[]
}

function AccountNodeView({ node, depth = 0 }: { node: AccountNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div>
      <div
        className={`flex items-center gap-2 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors ${depth > 0 ? "ml-6" : ""}`}
        style={{ borderLeft: depth > 0 ? "2px solid hsl(var(--border))" : undefined }}
        onClick={() => node.children && setExpanded(!expanded)}
      >
        {node.children ? (
          expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <div className="w-3.5" />
        )}
        <div className={`p-1.5 rounded-lg ${depth === 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          {depth === 0 ? <Building2 className="h-4 w-4" /> : <Building className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{node.name}</p>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {node.domain && <span>{node.domain}</span>}
            {node.industry && <span>· {node.industry}</span>}
            <span>· {node.contacts.length} contacts</span>
          </div>
        </div>
        <Badge variant="secondary" className="text-[10px]">{node.contacts.length} people</Badge>
      </div>

      {expanded && node.children?.map((child) => (
        <AccountNodeView key={child.id} node={child} depth={depth + 1} />
      ))}

      {expanded && node.contacts.length > 0 && (
        <div className={`space-y-1 mt-1 ${depth > 0 ? "ml-6" : ""}`}>
          {node.contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors ml-8"
            >
              <div className="p-1 rounded-full bg-primary/10 text-primary">
                <Users className="h-3 w-3" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{contact.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{contact.title}</p>
              </div>
              <div className="flex items-center gap-1">
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">
                    <Mail className="h-3 w-3" />
                  </a>
                )}
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">
                    <Phone className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Flattens the hierarchy into `{ id, label }` options for the "parent company" picker, indenting by depth. */
function flattenAccounts(nodes: AccountNode[], depth = 0): { id: string; label: string }[] {
  return nodes.flatMap((node) => [
    { id: node.id, label: `${"— ".repeat(depth)}${node.name}` },
    ...(node.children ? flattenAccounts(node.children, depth + 1) : []),
  ])
}

export function CrmAccountsHierarchy() {
  const [accounts, setAccounts] = useState<AccountNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDomain, setNewDomain] = useState("")
  const [newParentId, setNewParentId] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  const loadAccounts = useCallback(() => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    params.set("limit", "50")

    return fetch(`/api/v1/crm/companies?${params}`)
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json() })
      .then((data) => { setAccounts(data.companies ?? data ?? []); setError("") })
      .catch(() => setError("Could not load accounts"))
      .finally(() => setLoading(false))
  }, [search])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  const resetForm = () => {
    setNewName(""); setNewDomain(""); setNewParentId(""); setFormError("")
  }

  const handleAddAccount = async () => {
    if (!newName.trim()) return
    setSaving(true)
    setFormError("")
    try {
      const res = await fetch("/api/v1/crm/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          domain: newDomain.trim() || null,
          parent_id: newParentId || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to create account")
      }
      setAddOpen(false)
      resetForm()
      await loadAccounts()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create account")
    } finally {
      setSaving(false)
    }
  }

  const parentOptions = flattenAccounts(accounts)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <p className="text-sm font-medium">Account Hierarchy</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input className="h-8 w-48 rounded-md border border-input bg-background pl-8 pr-3 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" placeholder="Search accounts..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button size="sm" className="h-8" onClick={() => setAddOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" />Add Account</Button>
        </div>
      </div>

      {loading ? <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      : error ? <div className="text-xs text-red-500 p-4 text-center">{error}</div>
      : accounts.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8">No accounts found</p>
      : (
        <div className="border border-border/50 rounded-xl divide-y divide-border/50">
          {accounts.map((account) => (
            <div key={account.id} className="p-3">
              <AccountNodeView node={account} />
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {addOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => { setAddOpen(false); resetForm() }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="bg-card rounded-xl p-6 w-full max-w-md space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">New Account</h3>
                <Button variant="ghost" size="icon" onClick={() => { setAddOpen(false); resetForm() }}><X className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-3">
                {formError && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{formError}</div>
                )}
                <Input placeholder="Company name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Input placeholder="Domain (optional)" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={newParentId}
                  onChange={(e) => setNewParentId(e.target.value)}
                >
                  <option value="">No parent (top-level account)</option>
                  {parentOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setAddOpen(false); resetForm() }}>Cancel</Button>
                <Button onClick={handleAddAccount} disabled={!newName.trim() || saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Create Account
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}