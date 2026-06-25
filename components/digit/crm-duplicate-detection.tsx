"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Copy, CheckCircle2, XCircle, AlertTriangle, Search, Users, Building2, FileText } from "lucide-react"

interface DuplicateItem {
  id: string; type: "contact" | "account" | "deal" | "lead"
  name: string; email?: string; phone?: string; matchScore: number
  existing: { name: string; email?: string; phone?: string }
  fields: Array<{ field: string; value1: string; value2: string; match: boolean }>
}

const duplicates: DuplicateItem[] = [
  {
    id: "d1", type: "contact", name: "John Smith", email: "john.smith@acme.com", phone: "+1-555-0123", matchScore: 95,
    existing: { name: "Jon Smith", email: "jon@acme-corp.com", phone: "+1-555-0123" },
    fields: [
      { field: "Name", value1: "John Smith", value2: "Jon Smith", match: false },
      { field: "Email", value1: "john.smith@acme.com", value2: "jon@acme-corp.com", match: false },
      { field: "Phone", value1: "+1-555-0123", value2: "+1-555-0123", match: true },
    ],
  },
  {
    id: "d2", type: "account", name: "Acme Corp Inc", matchScore: 88,
    existing: { name: "Acme Corporation" },
    fields: [
      { field: "Name", value1: "Acme Corp Inc", value2: "Acme Corporation", match: false },
      { field: "Domain", value1: "acme.com", value2: "acme-corp.com", match: false },
      { field: "Industry", value1: "Technology", value2: "Technology", match: true },
    ],
  },
  {
    id: "d3", type: "lead", name: "Sarah.Johnson@email.com", email: "sarah.johnson@email.com", matchScore: 72,
    existing: { name: "Sarah Johnson", email: "s.johnson@email.com" },
    fields: [
      { field: "Name", value1: "Sarah.Johnson@email.com", value2: "Sarah Johnson", match: false },
      { field: "Email", value1: "sarah.johnson@email.com", value2: "s.johnson@email.com", match: false },
    ],
  },
]

const typeIcons = { contact: Users, account: Building2, deal: FileText, lead: Users }

export function CrmDuplicateDetection() {
  const [filter, setFilter] = useState("")

  const filtered = duplicates.filter(
    (d) => d.name.toLowerCase().includes(filter.toLowerCase()) || d.existing.name.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Copy className="h-5 w-5 text-orange-500" />
          <p className="text-sm font-medium">Duplicate Detection</p>
        </div>
        <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-500">{duplicates.length} found</Badge>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input placeholder="Search duplicates..." value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-8 text-sm" />
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-3">
          {filtered.map((item, i) => {
            const Icon = typeIcons[item.type]
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-3 rounded-xl border border-border/50"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">{item.name}</p>
                    <Badge className="text-[10px]" variant="secondary">{item.type}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {item.matchScore >= 90 ? (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                    <span className={`text-xs font-bold ${item.matchScore >= 90 ? "text-red-500" : "text-amber-500"}`}>
                      {item.matchScore}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <span className="line-through">{item.existing.name}</span>
                  <XCircle className="h-3 w-3 text-red-400" />
                  <span className="font-medium text-foreground">{item.name}</span>
                </div>

                <div className="space-y-1 mb-3">
                  {item.fields.map((f, j) => (
                    <div key={j} className="flex items-center gap-2 text-[11px]">
                      <span className="w-16 text-muted-foreground">{f.field}</span>
                      <span className="text-muted-foreground line-through">{f.value1}</span>
                      <span className={f.match ? "text-green-500" : "text-red-400"}>vs</span>
                      <span className="text-foreground">{f.value2}</span>
                      {f.match ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-400 ml-auto" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-[10px]">
                    <CheckCircle2 className="h-3 w-3 mr-1" />Merge & Dedupe
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[10px]">
                    <XCircle className="h-3 w-3 mr-1" />Discard New
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[10px]">
                    Keep Both
                  </Button>
                </div>
              </motion.div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
