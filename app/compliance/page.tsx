"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { CapaTable } from "@/components/compliance/capa-table"
import { CapaForm } from "@/components/compliance/capa-form"
import { AuditTrailViewer } from "@/components/compliance/audit-trail-viewer"
import { ComplianceScoreChart } from "@/components/compliance/compliance-score-chart"
import { FrameworkManager } from "@/components/compliance/framework-manager"
import { CapaRecord } from "@/lib/compliance/capa"
import { ComplianceAuditEntry } from "@/lib/compliance/audit-trail"
import { Plus, ShieldCheck, FileText, Search } from "lucide-react"

interface ComplianceScore {
  overall: number
  by_framework: Array<{
    framework: string
    score: number
    gaps: number
  }>
}

interface Framework {
  id: string
  name: string
  description: string | null
  controls_count: number
}

export default function CompliancePage() {
  const router = useRouter()
  const [capas, setCapas] = useState<CapaRecord[]>([])
  const [auditEntries, setAuditEntries] = useState<ComplianceAuditEntry[]>([])
  const [scores, setScores] = useState<ComplianceScore | null>(null)
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [isCapaDialogOpen, setIsCapaDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCapas = async () => {
    try {
      const res = await fetch("/api/v1/compliance/capas")
      if (!res.ok) throw new Error("Failed to fetch CAPAs")
      const data = await res.json()
      setCapas(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch CAPAs")
    }
  }

  const fetchAuditTrail = async () => {
    try {
      const res = await fetch("/api/v1/compliance/audit-trail")
      if (!res.ok) throw new Error("Failed to fetch audit trail")
      const data = await res.json()
      setAuditEntries(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch audit trail")
    }
  }

  const fetchScores = async () => {
    try {
      const res = await fetch("/api/v1/compliance/scores")
      if (!res.ok) throw new Error("Failed to fetch compliance scores")
      const data = await res.json()
      setScores(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch compliance scores")
    }
  }

  const fetchFrameworks = async () => {
    try {
      const res = await fetch("/api/v1/compliance/frameworks")
      if (!res.ok) throw new Error("Failed to fetch frameworks")
      const data = await res.json()
      setFrameworks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch frameworks")
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      await Promise.all([fetchCapas(), fetchAuditTrail(), fetchScores(), fetchFrameworks()])
      setIsLoading(false)
    }
    fetchData()
  }, [])

  const handleCreateCapa = async (values: Omit<CapaRecord, "id" | "organization_id" | "status" | "created_at" | "updated_at" | "closed_at" | "closed_by">) => {
    const res = await fetch("/api/v1/compliance/capas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })
    if (!res.ok) throw new Error("Failed to create CAPA")
    await fetchCapas()
    setIsCapaDialogOpen(false)
  }

  const handleRunAudit = async () => {
    setIsLoading(true)
    await fetchAuditTrail()
    setIsLoading(false)
  }

  if (isLoading) return <div className="p-4">Loading...</div>
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Compliance Management</h1>
        <div className="flex gap-2">
          <Dialog open={isCapaDialogOpen} onOpenChange={setIsCapaDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> New CAPA
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New CAPA</DialogTitle>
              </DialogHeader>
              <CapaForm onSubmit={handleCreateCapa} />
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={handleRunAudit}>
            <Search className="h-4 w-4 mr-2" /> Run Audit
          </Button>
          <Button variant="outline">
            <ShieldCheck className="h-4 w-4 mr-2" /> Compliance Score: {scores?.overall || 0}%
          </Button>
        </div>
      </div>

      <Tabs defaultValue="capas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="capas">CAPA Management</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          <TabsTrigger value="scores">Compliance Scores</TabsTrigger>
          <TabsTrigger value="frameworks">Regulatory Frameworks</TabsTrigger>
        </TabsList>

        <TabsContent value="capas">
          <Card>
            <CardHeader>
              <CardTitle>Corrective and Preventive Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <CapaTable capas={capas} onView={(capa) => router.push(`/compliance/capas/${capa.id}`)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Audit Trail</CardTitle>
            </CardHeader>
            <CardContent>
              <AuditTrailViewer entries={auditEntries} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scores">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Scores</CardTitle>
            </CardHeader>
            <CardContent>
              {scores && <ComplianceScoreChart data={scores.by_framework} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="frameworks">
          <Card>
            <CardHeader>
              <CardTitle>Regulatory Frameworks</CardTitle>
            </CardHeader>
            <CardContent>
              <FrameworkManager frameworks={frameworks} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}