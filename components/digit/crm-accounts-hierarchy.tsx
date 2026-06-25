"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Building2, Users, Plus, ChevronRight, ChevronDown, Building, Search, Mail, Phone } from "lucide-react"

interface AccountNode {
  id: string; name: string; domain: string | null; industry: string | null
  contacts: Array<{ id: string; name: string; email: string | null; phone: string | null; title: string | null }>
  children?: AccountNode[]
}

const sampleAccounts: AccountNode[] = [
  {
    id: "acme-corp", name: "Acme Corp", domain: "acme.com", industry: "Manufacturing",
    contacts: [
      { id: "c1", name: "John Smith", email: "john@acme.com", phone: "+1-555-0101", title: "CEO" },
      { id: "c2", name: "Sarah Chen", email: "sarah@acme.com", phone: "+1-555-0102", title: "CTO" },
    ],
    children: [
      {
        id: "acme-eu", name: "Acme Europe GmbH", domain: "acme-eu.de", industry: "Manufacturing",
        contacts: [
          { id: "c3", name: "Hans Mueller", email: "hans@acme-eu.de", phone: "+49-30-1234", title: "Managing Director" },
        ],
      },
      {
        id: "acme-asia", name: "Acme Asia Pte Ltd", domain: "acme-asia.sg", industry: "Manufacturing",
        contacts: [
          { id: "c4", name: "Lin Wei", email: "lin@acme-asia.sg", phone: "+65-6789-0123", title: "Regional Head" },
        ],
      },
    ],
  },
  {
    id: "green-energy", name: "Green Energy Inc", domain: "greenenergy.io", industry: "Renewable Energy",
    contacts: [
      { id: "c5", name: "Emma Rodriguez", email: "emma@greenenergy.io", phone: "+1-555-0201", title: "VP Operations" },
    ],
  },
]

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

export function CrmAccountsHierarchy() {
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
            <input className="h-8 w-48 rounded-md border border-input bg-background pl-8 pr-3 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" placeholder="Search accounts..." />
          </div>
          <Button size="sm" className="h-8"><Plus className="h-3.5 w-3.5 mr-1" />Add Account</Button>
        </div>
      </div>

      <div className="border border-border/50 rounded-xl divide-y divide-border/50">
        {sampleAccounts.map((account) => (
          <div key={account.id} className="p-3">
            <AccountNodeView node={account} />
          </div>
        ))}
      </div>
    </div>
  )
}
