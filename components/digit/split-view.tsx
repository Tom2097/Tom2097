"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { FileText, Database, MessageSquare } from "lucide-react"

interface SplitViewProps {
  document: { id: string; name: string; content?: string; extracted_entities?: Record<string, unknown> } | null
}

export function SplitView({ document }: SplitViewProps) {
  const [activeView, setActiveView] = useState("document")

  if (!document) return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Select a document to view</div>

  return (
    <div className="grid grid-cols-2 h-full border border-border rounded-lg overflow-hidden">
      {/* Left panel - document */}
      <div className="border-r border-border">
        <div className="p-3 border-b border-border bg-muted/20">
          <p className="text-sm font-medium truncate">{document.name}</p>
        </div>
        <ScrollArea className="h-[calc(100%-45px)]">
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words">{document.content ?? "(no content)"}</pre>
        </ScrollArea>
      </div>

      {/* Right panel - tabs */}
      <div className="flex flex-col">
        <Tabs value={activeView} onValueChange={setActiveView} className="flex-1 flex flex-col">
          <TabsList className="grid grid-cols-3 mx-2 mt-2">
            <TabsTrigger value="extracted" className="text-xs"><Database className="h-3 w-3 mr-1" />Data</TabsTrigger>
            <TabsTrigger value="chat" className="text-xs"><MessageSquare className="h-3 w-3 mr-1" />AI Chat</TabsTrigger>
            <TabsTrigger value="document" className="text-xs"><FileText className="h-3 w-3 mr-1" />Raw</TabsTrigger>
          </TabsList>

          <TabsContent value="extracted" className="flex-1 p-4 mt-0">
            {document.extracted_entities ? (
              <pre className="text-xs font-mono whitespace-pre-wrap">{JSON.stringify(document.extracted_entities, null, 2)}</pre>
            ) : (
              <p className="text-sm text-muted-foreground">No extracted data yet</p>
            )}
          </TabsContent>

          <TabsContent value="chat" className="flex-1 p-4 mt-0">
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Ask a question about this document</p>
            </div>
          </TabsContent>

          <TabsContent value="document" className="flex-1 p-4 mt-0">
            <pre className="text-xs font-mono whitespace-pre-wrap break-words">{document.content ?? "(no content)"}</pre>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
