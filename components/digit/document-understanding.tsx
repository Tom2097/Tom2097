"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Brain, Sparkles, FileSearch, MessageSquare, ListTree, Loader2, CheckCircle2, AlertCircle, User, Building2, Calendar, DollarSign, Hash, FileText, AtSign, Phone } from "lucide-react"

interface UnderstandingData {
  classification: { primary: string; confidence: number; secondary: string[] } | null
  summary: { summary: string; keyPoints: string[] } | null
  entities: Array<{ text: string; type: string; confidence: number }> | null
  extracted_fields: Array<{ name: string; value: string; confidence: number }> | null
}

const entityIcons: Record<string, React.ReactNode> = {
  PERSON: <User className="h-3 w-3" />,
  ORGANIZATION: <Building2 className="h-3 w-3" />,
  DATE: <Calendar className="h-3 w-3" />,
  MONEY: <DollarSign className="h-3 w-3" />,
  PERCENT: <Hash className="h-3 w-3" />,
  EMAIL: <AtSign className="h-3 w-3" />,
  PHONE: <Phone className="h-3 w-3" />,
}

export function DocumentUnderstanding({ documentId, content }: { documentId: string; content?: string }) {
  const [data, setData] = useState<UnderstandingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const runUnderstanding = async () => {
    if (!content) return
    setLoading(true)
    try {
      const res = await fetch("/api/v1/operations/understand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, content }),
      })
      const json = await res.json()
      setData(json.data)
    } catch {} finally { setLoading(false) }
  }

  if (!content) return null

  return (
    <div className="space-y-3">
      {!data && (
        <Button onClick={runUnderstanding} disabled={loading} size="sm" className="w-full">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
          {loading ? "Understanding..." : "Run Full Understanding"}
        </Button>
      )}

      <AnimatePresence>
        {data && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {data.classification && (
              <Card>
                <CardHeader className="p-3 pb-1 flex flex-row items-center gap-2 cursor-pointer" onClick={() => setExpanded(expanded === "classify" ? null : "classify")}>
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  <CardTitle className="text-xs font-medium">Classification</CardTitle>
                  <Badge variant="secondary" className="text-[10px] ml-auto">{data.classification.confidence}%</Badge>
                </CardHeader>
                {expanded === "classify" && (
                  <CardContent className="p-3 pt-1">
                    <Badge>{data.classification.primary}</Badge>
                    {data.classification.secondary.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {data.classification.secondary.map((s) => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            )}

            {data.summary && (
              <Card>
                <CardHeader className="p-3 pb-1 flex flex-row items-center gap-2 cursor-pointer" onClick={() => setExpanded(expanded === "summary" ? null : "summary")}>
                  <MessageSquare className="h-4 w-4 text-purple-500" />
                  <CardTitle className="text-xs font-medium">Summary</CardTitle>
                  <Badge variant="secondary" className="text-[10px] ml-auto">{data.summary.keyPoints.length} points</Badge>
                </CardHeader>
                {expanded === "summary" && (
                  <CardContent className="p-3 pt-1">
                    <p className="text-xs text-muted-foreground mb-2">{data.summary.summary}</p>
                    {data.summary.keyPoints.length > 0 && (
                      <ul className="space-y-1">
                        {data.summary.keyPoints.map((kp, i) => (
                          <li key={i} className="text-xs flex gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{kp}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                )}
              </Card>
            )}

            {data.entities && data.entities.length > 0 && (
              <Card>
                <CardHeader className="p-3 pb-1 flex flex-row items-center gap-2 cursor-pointer" onClick={() => setExpanded(expanded === "entities" ? null : "entities")}>
                  <FileSearch className="h-4 w-4 text-amber-500" />
                  <CardTitle className="text-xs font-medium">Entities</CardTitle>
                  <Badge variant="secondary" className="text-[10px] ml-auto">{data.entities.length} found</Badge>
                </CardHeader>
                {expanded === "entities" && (
                  <CardContent className="p-3 pt-1">
                    <div className="flex flex-wrap gap-1.5">
                      {data.entities.map((e, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] flex items-center gap-1">
                          {entityIcons[e.type] ?? <Hash className="h-3 w-3" />}
                          {e.text}
                          <span className="text-muted-foreground ml-0.5">({e.type})</span>
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {data.extracted_fields && data.extracted_fields.length > 0 && (
              <Card>
                <CardHeader className="p-3 pb-1 flex flex-row items-center gap-2 cursor-pointer" onClick={() => setExpanded(expanded === "fields" ? null : "fields")}>
                  <ListTree className="h-4 w-4 text-emerald-500" />
                  <CardTitle className="text-xs font-medium">Extracted Fields</CardTitle>
                  <Badge variant="secondary" className="text-[10px] ml-auto">{data.extracted_fields.length} fields</Badge>
                </CardHeader>
                {expanded === "fields" && (
                  <CardContent className="p-3 pt-1">
                    <div className="space-y-1">
                      {data.extracted_fields.map((f, i) => (
                        <div key={i} className="flex items-center justify-between p-1.5 rounded bg-muted/30">
                          <div>
                            <span className="text-xs font-medium">{f.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{f.value}</span>
                          </div>
                          <Badge variant="secondary" className="text-[10px]">{f.confidence}%</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
