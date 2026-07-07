"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CapaRecord } from "@/lib/compliance/capa"
import { format } from "date-fns"
import { ArrowUpDown, Eye, Pencil } from "lucide-react"

interface CapaTableProps {
  capas: CapaRecord[]
  onView?: (capa: CapaRecord) => void
  onEdit?: (capa: CapaRecord) => void
}

export function CapaTable({ capas, onView, onEdit }: CapaTableProps) {
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "open": return "destructive"
      case "investigation": return "secondary"
      case "action": return "default"
      case "verification": return "secondary"
      case "closed": return "default"
      default: return "outline"
    }
  }

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case "minor": return "secondary"
      case "major": return "default"
      case "critical": return "destructive"
      default: return "outline"
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>
            <Button variant="ghost" size="sm" className="gap-1">
              Severity <ArrowUpDown className="h-3 w-3" />
            </Button>
          </TableHead>
          <TableHead>
            <Button variant="ghost" size="sm" className="gap-1">
              Status <ArrowUpDown className="h-3 w-3" />
            </Button>
          </TableHead>
          <TableHead>Assigned To</TableHead>
          <TableHead>SLA Deadline</TableHead>
          <TableHead>Created At</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {capas.map((capa) => (
          <TableRow key={capa.id}>
            <TableCell className="font-medium">{capa.title}</TableCell>
            <TableCell>{capa.source}</TableCell>
            <TableCell>
              <Badge variant={getSeverityBadgeVariant(capa.severity)}>
                {capa.severity}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={getStatusBadgeVariant(capa.status)}>
                {capa.status}
              </Badge>
            </TableCell>
            <TableCell>{capa.assigned_to || "-"}</TableCell>
            <TableCell>
              {capa.sla_deadline ? format(new Date(capa.sla_deadline), "PP") : "-"}
            </TableCell>
            <TableCell>{format(new Date(capa.created_at), "PP")}</TableCell>
            <TableCell className="flex gap-2">
              {onView && (
                <Button variant="outline" size="sm" onClick={() => onView(capa)}>
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              {onEdit && (
                <Button variant="outline" size="sm" onClick={() => onEdit(capa)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}