import { UniversalIntake } from "@/components/digit/universal-intake"
import { DocumentFeed } from "@/components/digit/document-feed"
import { OperationalCopilot } from "@/components/digit/operational-copilot"
import { VerticalIntelligence } from "@/components/digit/vertical-intelligence"
import { VerticalRecipes } from "@/components/digit/vertical-recipes"
import { CommandPalette } from "@/components/digit/command-palette"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Inbox, Bot, Beaker, BookTemplate, Command } from "lucide-react"

export default function OperationsPage() {
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
              <TabsTrigger value="intelligence"><Beaker className="h-4 w-4 mr-1" />Intelligence</TabsTrigger>
              <TabsTrigger value="recipes"><BookTemplate className="h-4 w-4 mr-1" />Recipes</TabsTrigger>
            </TabsList>
            <TabsContent value="feed" className="mt-4">
              <DocumentFeed />
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
          <OperationalCopilot />
        </div>
      </div>
    </div>
  )
}
