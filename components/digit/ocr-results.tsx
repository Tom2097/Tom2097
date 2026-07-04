"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { FileText, ScanLine, Download, Copy, Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface OcrBlock {
  text: string
  confidence: number
  bbox: { x: number; y: number; w: number; h: number }
}

interface OcrResultData {
  text: string
  confidence: number
  blocks: OcrBlock[]
  language: string
}

interface OcrResultsProps {
  result: OcrResultData
  documentName?: string
  onReRun?: () => void
  reRunning?: boolean
}

function ConfidenceBadge({ value }: { value: number }) {
  const color = value >= 90 ? "bg-chart-2/20 text-chart-2" : value >= 70 ? "bg-amber-500/20 text-amber-600" : "bg-destructive/20 text-destructive"
  return <Badge variant="secondary" className={color}>{value}%</Badge>
}

export function OcrResults({ result, documentName, onReRun, reRunning }: OcrResultsProps) {
  const [copied, setCopied] = useState(false)
  const [expandedBlocks, setExpandedBlocks] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(result.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([result.text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${documentName || "ocr"}-extracted.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card className="p-6 border-border/50 bg-card/50">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ScanLine className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">OCR Results</h3>
            {documentName && <p className="text-xs text-muted-foreground">{documentName}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ConfidenceBadge value={result.confidence} />
          {onReRun && (
            <Button variant="outline" size="sm" onClick={onReRun} disabled={reRunning}>
              {reRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
              Re-run
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="text">
        <TabsList className="mb-4">
          <TabsTrigger value="text" className="gap-2">
            <FileText className="w-4 h-4" />
            Extracted Text
          </TabsTrigger>
          <TabsTrigger value="blocks" className="gap-2">
            <ScanLine className="w-4 h-4" />
            Blocks ({result.blocks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="text">
          <div className="relative">
            <pre className="p-4 rounded-lg bg-muted/30 text-sm font-mono whitespace-pre-wrap max-h-96 overflow-auto">
              {result.text || "No text extracted"}
            </pre>
            <div className="absolute top-2 right-2 flex gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCopy}>
                {copied ? <Check className="w-4 h-4 text-chart-2" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleDownload}>
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span>Language: {result.language}</span>
            <span>{result.text.length} characters</span>
          </div>
        </TabsContent>

        <TabsContent value="blocks">
          <div className="space-y-2 max-h-96 overflow-auto">
            <button
              onClick={() => setExpandedBlocks(!expandedBlocks)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mb-2"
            >
              {expandedBlocks ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expandedBlocks ? "Collapse all" : "Expand all"}
            </button>
            {result.blocks.map((block, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="p-3 rounded-lg border border-border/50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Block {i + 1}</span>
                  <ConfidenceBadge value={block.confidence} />
                </div>
                <p className={`text-sm ${expandedBlocks ? "" : "line-clamp-2"}`}>{block.text}</p>
              </motion.div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  )
}
