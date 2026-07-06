"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ComplianceAuditEntry } from "@/lib/compliance/audit-trail"
import { format } from "date-fns"

interface AuditTrailViewerProps {
  entries: ComplianceAuditEntry[]
}

export function AuditTrailViewer({ entries }: AuditTrailViewerProps) {
  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case "CREATE": return "success"
      case "UPDATE": return "info"
      case "DELETE": return "destructive"
      default: return "secondary"
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Timestamp</TableHead>
          <TableHead>Record Type</TableHead>
          <TableHead>Record ID</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Changed By</TableHead>
          <TableHead>IP Address</TableHead>
          <TableHead>Hash</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell>{format(new Date(entry.created_at), "PPpp")}</TableCell>
            <TableCell>{entry.record_type}</TableCell>
            <TableCell>{entry.record_id}</TableCell>
            <TableCell>
              <Badge variant={getActionBadgeVariant(entry.action)}>
                {entry.action}
              </Badge>
            </TableCell>
            <TableCell>{entry.changed_by || "-"}</TableCell>
            <TableCell>{entry.ip_address || "-"}</TableCell>
            <TableCell className="font-mono text-xs">{entry.hash.slice(0, 12)}...</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}