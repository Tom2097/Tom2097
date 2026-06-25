"use client"

import { useState } from "react"
import { UniversalIntake } from "@/components/digit/universal-intake"
import { DocumentFeed } from "@/components/digit/document-feed"
import { SplitView } from "@/components/digit/split-view"
import { CompareView } from "@/components/digit/compare-view"
import { OperationalCopilot } from "@/components/digit/operational-copilot"
import { VerticalIntelligence } from "@/components/digit/vertical-intelligence"
import { VerticalRecipes } from "@/components/digit/vertical-recipes"
import { CommandPalette } from "@/components/digit/command-palette"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Inbox, Beaker, BookTemplate, Columns, ArrowLeftRight, Brain, FileSearch, MessageSquare, Sparkles, ListTree, Zap, FileText } from "lucide-react"

const sampleDocuments = [
  { id: "doc-1", name: "Invoice_Acme_2024.pdf", content: "INVOICE #INV-001\nDate: 2024-01-15\nVendor: Acme Corp\nTotal: $12,500.00\nItems:\n  - Widget A x 50: $5,000\n  - Widget B x 30: $7,500" },
  { id: "doc-2", name: "Contract_ABC_License.pdf", content: "SOFTWARE LICENSE AGREEMENT\nParty: ABC Software Inc.\nTerm: 12 months\nFee: $24,000/year\nAuto-renew: Yes\nGoverning Law: Delaware" },
  { id: "doc-3", name: "Inspection_Report_Q1.pdf", content: "INSPECTION REPORT\nFacility: Plant 7\nDate: 2024-03-01\nInspector: J. Smith\nFindings: 3 minor, 1 major\nCorrective actions: Pending" },
]

export default function OperationsPage() {
  const [selectedDoc, setSelectedDoc] = useState<{ id: string; name: string; content?: string; extracted_entities?: Record<string, unknown> } | null>(null)
  const [feedItems, setFeedItems] = useState<Array<{ id: string; name: string; content?: string; extracted_entities?: Record<string, unknown> }>>([])

  const handleSelectDoc = (doc: { id: string; name: string; content?: string; extracted_entities?: Record<string, unknown> }) => {
    setSelectedDoc(doc)
    setFeedItems((prev) => {
      if (prev.find((d) => d.id === doc.id)) return prev
      return [...prev, doc]
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-500">
            <Inbox className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Operations Workspace</h1>
            <p className="text-sm text-muted-foreground">Unified intake hub — ingest, understand, act, and review</p>
          </div>
        </div>
        <CommandPalette />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <UniversalIntake />

          <Tabs defaultValue="feed">
            <TabsList>
              <TabsTrigger value="feed"><Inbox className="h-4 w-4 mr-1" />Feed</TabsTrigger>
              <TabsTrigger value="split"><Columns className="h-4 w-4 mr-1" />Split View</TabsTrigger>
              <TabsTrigger value="compare"><ArrowLeftRight className="h-4 w-4 mr-1" />Compare</TabsTrigger>
              <TabsTrigger value="intelligence"><Beaker className="h-4 w-4 mr-1" />Intelligence</TabsTrigger>
              <TabsTrigger value="recipes"><BookTemplate className="h-4 w-4 mr-1" />Recipes</TabsTrigger>
            </TabsList>

            <TabsContent value="feed" className="mt-4">
              <div className="grid grid-cols-1 gap-4">
                <DocumentFeed onSelectDoc={handleSelectDoc} />
              </div>
            </TabsContent>

            <TabsContent value="split" className="mt-4">
              <div className="h-[60vh]">
                <SplitView document={selectedDoc} />
              </div>
            </TabsContent>

            <TabsContent value="compare" className="mt-4">
              <CompareView documents={feedItems.length > 0 ? feedItems : sampleDocuments} />
            </TabsContent>

            <TabsContent value="intelligence" className="mt-4">
              <VerticalIntelligence />
            </TabsContent>

            <TabsContent value="recipes" className="mt-4">
              <VerticalRecipes />
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Brain className="h-4 w-4 text-indigo-500" />
                Understanding Layer
              </CardTitle>
              <CardDescription className="text-xs">AI-powered classification, extraction, and summarization</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3">
              <div className="flex items-center justify-between p-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-medium">Classification</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">Auto</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <div className="flex items-center gap-2">
                  <FileSearch className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs font-medium">Field Extraction</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">Invoice, Contract, +3</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-purple-500/5 border border-purple-500/10">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-purple-500" />
                  <span className="text-xs font-medium">Summarization</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">Key Points</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-medium">Entity Recognition</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">People, Orgs, Dates</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ListTree className="h-4 w-4 text-amber-500" />
                Action Layer
              </CardTitle>
              <CardDescription className="text-xs">Auto-create tasks, draft responses, trigger workflows</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3">
              <div className="flex items-center justify-between p-2 rounded-lg bg-green-500/5 border border-green-500/10">
                <div className="flex items-center gap-2">
                  <ListTree className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-xs font-medium">Auto-Create Tasks</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">CAPA, Payables</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-medium">Draft Response</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">AI-Powered</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="text-xs font-medium">Recipe Execution</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">4 Playbooks</Badge>
              </div>
            </CardContent>
          </Card>

          <OperationalCopilot />
        </div>
      </div>
    </div>
  )
}
