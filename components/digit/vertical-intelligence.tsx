"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Beaker, FileSearch, AlertTriangle, TrendingUp, Loader2 } from "lucide-react"
import { toast } from "sonner"

const extractors = {
  pharma: [
    { name: "Batch Record Parser", fields: "Batch ID, Product, Date, Parameters, Sign-offs", confidence: "92%" },
    { name: "COA Extractor", fields: "Lot #, Tests, Results, Limits, Status", confidence: "95%" },
    { name: "Deviation Classifier", fields: "Type, Severity, Root Cause, Impact", confidence: "88%" },
    { name: "Stability Reader", fields: "Timepoints, Conditions, Results, Trends", confidence: "90%" },
  ],
  renewables: [
    { name: "Site Survey Parser", fields: "Coordinates, Terrain, Access, Zoning", confidence: "85%" },
    { name: "Generation Analyzer", fields: "Output, Efficiency, Downtime, Weather", confidence: "91%" },
    { name: "O&M Log Reader", fields: "Asset, Task, Labour, Parts, Duration", confidence: "89%" },
    { name: "Turbine Inspection", fields: "Component, Finding, Severity, Action", confidence: "87%" },
  ],
  logistics: [
    { name: "POD Parser", fields: "Consignment, Recipient, Date, Signature", confidence: "96%" },
    { name: "E-Way Bill Reader", fields: "Doc #, Origin, Destination, Value, Validity", confidence: "93%" },
    { name: "Manifest Parser", fields: "Items, Quantities, Packaging, Weight", confidence: "91%" },
    { name: "Customs Doc Analyzer", fields: "HS Code, Value, Origin, Duty, Status", confidence: "88%" },
  ],
}

export function VerticalIntelligence() {
  const [vertical, setVertical] = useState("pharma")
  const [testing, setTesting] = useState<string | null>(null)
  const currentExtractors = extractors[vertical as keyof typeof extractors]

  const handleTest = async (ext: { name: string; fields: string }) => {
    setTesting(ext.name)
    try {
      const res = await fetch("/api/v1/operations/test-extractor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extractor: ext.name, vertical, fields: ext.fields }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Test failed")
        return
      }
      const count = data.results?.length ?? 0
      toast.success(count > 0 ? `Extracted ${count} field${count === 1 ? "" : "s"} from sample document` : "No fields extracted from sample")
    } catch {
      toast.error("Test failed")
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="space-y-6">
      <Tabs value={vertical} onValueChange={setVertical}>
        <TabsList>
          <TabsTrigger value="pharma"><Beaker className="h-4 w-4 mr-1.5" />Pharma</TabsTrigger>
          <TabsTrigger value="renewables"><TrendingUp className="h-4 w-4 mr-1.5" />Renewables</TabsTrigger>
          <TabsTrigger value="logistics"><FileSearch className="h-4 w-4 mr-1.5" />Logistics</TabsTrigger>
        </TabsList>

        {Object.entries(extractors).map(([key, exts]) => (
          <TabsContent key={key} value={key} className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {exts.map((ext) => (
                <Card key={ext.name}>
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm">{ext.name}</CardTitle>
                      <Badge variant="secondary" className="text-[10px]">{ext.confidence} accuracy</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <p className="text-xs text-muted-foreground mb-2">Extracts: {ext.fields}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleTest(ext)} disabled={testing === ext.name}>
                        {testing === ext.name ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                        Test
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
