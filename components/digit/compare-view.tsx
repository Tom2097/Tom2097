"use client"

import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ArrowLeftRight } from "lucide-react"

interface DocSummary {
  id: string; name: string; content?: string
}

interface DiffLine {
  type: "same" | "added" | "removed" | "modified"
  left: string
  right: string
}

function computeDiff(left: string, right: string): DiffLine[] {
  const lLines = left.split("\n")
  const rLines = right.split("\n")
  const maxLen = Math.max(lLines.length, rLines.length)
  const result: DiffLine[] = []

  for (let i = 0; i < maxLen; i++) {
    const l = lLines[i] ?? ""
    const r = rLines[i] ?? ""
    if (l === r) result.push({ type: "same", left: l, right: r })
    else if (!l) result.push({ type: "added", left: "", right: r })
    else if (!r) result.push({ type: "removed", left: l, right: "" })
    else result.push({ type: "modified", left: l, right: r })
  }
  return result
}

export function CompareView({ documents }: { documents: DocSummary[] }) {
  const [leftId, setLeftId] = useState(documents[0]?.id ?? "")
  const [rightId, setRightId] = useState(documents[1]?.id ?? "")

  const left = documents.find((d) => d.id === leftId)
  const right = documents.find((d) => d.id === rightId)
  const diffs = left?.content && right?.content ? computeDiff(left.content, right.content) : []

  const lineColors: Record<string, string> = {
    same: "",
    added: "bg-green-500/10",
    removed: "bg-red-500/10",
    modified: "bg-yellow-500/10",
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={leftId} onValueChange={setLeftId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Select left" /></SelectTrigger>
          <SelectContent>{documents.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
        <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
        <Select value={rightId} onValueChange={setRightId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Select right" /></SelectTrigger>
          <SelectContent>{documents.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => { setLeftId(rightId); setRightId(leftId) }}>Swap</Button>
      </div>

      <div className="grid grid-cols-2 gap-0 border border-border rounded-lg overflow-hidden">
        <ScrollArea className="h-[60vh]">
          <div className="p-2 border-b border-border bg-muted/20 text-xs font-medium">{left?.name ?? ""}</div>
          <div className="p-2">
            {diffs.map((d, i) => (
              <div key={i} className={`${lineColors[d.type]} flex`}>
                <span className="w-6 text-[10px] text-muted-foreground shrink-0 text-right mr-2">{i + 1}</span>
                <span className={`text-xs font-mono whitespace-pre-wrap ${d.type === "removed" ? "text-red-500 line-through" : ""}`}>{d.left}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
        <ScrollArea className="h-[60vh] border-l border-border">
          <div className="p-2 border-b border-border bg-muted/20 text-xs font-medium">{right?.name ?? ""}</div>
          <div className="p-2">
            {diffs.map((d, i) => (
              <div key={i} className={`${lineColors[d.type]} flex`}>
                <span className="w-6 text-[10px] text-muted-foreground shrink-0 text-right mr-2">{i + 1}</span>
                <span className={`text-xs font-mono whitespace-pre-wrap ${d.type === "added" ? "text-green-500" : d.type === "modified" ? "text-yellow-500" : ""}`}>{d.right}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
