"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Beaker, FileSearch, AlertTriangle, TrendingUp } from "lucide-react"

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
  const currentExtractors = extractors[vertical as keyof typeof extractors]

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
                      <Button size="sm" variant="outline" className="text-xs h-7">Test</Button>
                      <Button size="sm" className="text-xs h-7">Configure</Button>
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
