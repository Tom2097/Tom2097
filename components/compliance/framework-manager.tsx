"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { Eye, Pencil } from "lucide-react"

interface Framework {
  id: string
  name: string
  description: string | null
  controls_count: number
  created_at: string
}

interface FrameworkManagerProps {
  frameworks: Framework[]
  onView?: (framework: Framework) => void
  onEdit?: (framework: Framework) => void
}

export function FrameworkManager({ frameworks, onView, onEdit }: FrameworkManagerProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Controls</TableHead>
          <TableHead>Created At</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {frameworks.map((framework) => (
          <TableRow key={framework.id}>
            <TableCell className="font-medium">{framework.name}</TableCell>
            <TableCell>{framework.description || "-"}</TableCell>
            <TableCell>
              <Badge variant="secondary">{framework.controls_count}</Badge>
            </TableCell>
            <TableCell>{format(new Date(framework.created_at), "PP")}</TableCell>
            <TableCell className="flex gap-2">
              {onView && (
                <Button variant="outline" size="sm" onClick={() => onView(framework)}>
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              {onEdit && (
                <Button variant="outline" size="sm" onClick={() => onEdit(framework)}>
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