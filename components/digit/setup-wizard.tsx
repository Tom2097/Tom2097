"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Check, Building2, SlidersHorizontal, Database, Puzzle, Shield, Rocket, Loader2 } from "lucide-react"
import { ComplianceFrameworkPanel, ResourcesFrameworkPanel, PerformanceFrameworkPanel, OperationalFrameworkPanel } from "@/components/digit/wizard-panels"

const steps = [
  { id: "general", title: "General", icon: Building2 },
  { id: "framework", title: "Framework", icon: SlidersHorizontal },
  { id: "data", title: "Data & Integrations", icon: Database },
  { id: "features", title: "Features & Automations", icon: Puzzle },
  { id: "roles", title: "Roles & Access", icon: Shield },
  { id: "review", title: "Review & Activate", icon: Rocket },
]

const verticals = ["Compliance", "Resources", "Performance", "Operational"]

interface SetupWizardProps {
  onComplete: () => void
  initialVertical?: string
}

export function SetupWizard({ onComplete, initialVertical = "compliance" }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [vertical, setVertical] = useState(initialVertical)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [formData, setFormData] = useState<Record<string, unknown>>({
    name: "",
    description: "",
    vertical: initialVertical,
    owner: "",
    dataSources: [] as string[],
    autoClassify: true,
    autoRoute: true,
    hitlEnabled: true,
    teamRoles: "admin,editor,viewer",
    acceptTerms: false,
  })

  const update = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const updateFramework = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0: return String(formData.name).trim().length > 0
      case 5: return formData.acceptTerms as boolean
      default: return true
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/v1/configure/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      const json = await res.json()
      if (json.success) {
        setSaved(true)
        setTimeout(() => onComplete(), 1500)
      }
    } catch {} finally { setSaving(false) }
  }

  const next = () => {
    if (currentStep < steps.length - 1) setCurrentStep((s) => s + 1)
    else save()
  }

  const prev = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1)
  }

  const Step = steps[currentStep]

  const frameworkPanel = () => {
    switch (vertical) {
      case "compliance": return <ComplianceFrameworkPanel data={formData} onChange={updateFramework} />
      case "resources": return <ResourcesFrameworkPanel data={formData} onChange={updateFramework} />
      case "performance": return <PerformanceFrameworkPanel data={formData} onChange={updateFramework} />
      case "operational": return <OperationalFrameworkPanel data={formData} onChange={updateFramework} />
      default: return null
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between mb-6">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  i <= currentStep ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {i < currentStep ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                {i < steps.length - 1 && <div className={`w-8 h-0.5 mx-1 ${i < currentStep ? "bg-primary" : "bg-muted"}`} />}
              </div>
            ))}
          </div>
          <CardTitle className="flex items-center gap-2">
            <Step.icon className="h-5 w-5 text-primary" />
            {Step.title}
          </CardTitle>
          <CardDescription>Step {currentStep + 1} of {steps.length}</CardDescription>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {currentStep === 0 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="ws-name">Workspace Name</Label>
                    <Input id="ws-name" placeholder="My Workspace" value={formData.name as string} onChange={(e) => update("name", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ws-desc">Description</Label>
                    <Input id="ws-desc" placeholder="What is this workspace for?" value={formData.description as string} onChange={(e) => update("description", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Vertical</Label>
                    <Select value={vertical} onValueChange={(v) => { setVertical(v); update("vertical", v) }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {verticals.map((v) => <SelectItem key={v.toLowerCase()} value={v.toLowerCase()}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Workspace Owner</Label>
                    <Input placeholder="user@example.com" value={formData.owner as string} onChange={(e) => update("owner", e.target.value)} />
                  </div>
                </>
              )}

              {currentStep === 1 && frameworkPanel()}

              {currentStep === 2 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground mb-2">Connect external data sources to this workspace:</p>
                  {["Gmail", "Google Drive", "Slack", "SharePoint", "Dropbox", "Custom API"].map((source) => (
                    <div key={source} className="flex items-center justify-between">
                      <Label>{source}</Label>
                      <Switch
                        checked={((formData.dataSources as string[]) ?? []).includes(source)}
                        onCheckedChange={(v) => {
                          const current = (formData.dataSources as string[]) ?? []
                          update("dataSources", v ? [...current, source] : current.filter((s) => s !== source))
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Auto-classify documents</Label>
                    <Switch checked={formData.autoClassify as boolean} onCheckedChange={(v) => update("autoClassify", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Auto-route to workspace</Label>
                    <Switch checked={formData.autoRoute as boolean} onCheckedChange={(v) => update("autoRoute", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Human-in-the-loop review</Label>
                    <Switch checked={formData.hitlEnabled as boolean} onCheckedChange={(v) => update("hitlEnabled", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Auto-create tasks from classification</Label>
                    <Switch checked={formData.autoCreateTasks as boolean} onCheckedChange={(v) => update("autoCreateTasks", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Generate workflows from documents</Label>
                    <Switch checked={formData.docToWorkflow as boolean} onCheckedChange={(v) => update("docToWorkflow", v)} />
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Roles (comma-separated)</Label>
                    <Input value={formData.teamRoles as string} onChange={(e) => update("teamRoles", e.target.value)} />
                    <p className="text-xs text-muted-foreground">Define roles for this workspace</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Enforce MFA for sensitive actions</Label>
                    <Switch checked={formData.mfaEnforced as boolean} onCheckedChange={(v) => update("mfaEnforced", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Audit logging</Label>
                    <Switch checked={true} disabled />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>IP whitelist enforcement</Label>
                    <Switch checked={formData.ipWhitelist as boolean} onCheckedChange={(v) => update("ipWhitelist", v)} />
                  </div>
                </div>
              )}

              {currentStep === 5 && (
                <div className="space-y-4 text-center">
                  <Rocket className="h-12 w-12 mx-auto text-primary" />
                  <p className="text-lg font-medium">Ready to activate!</p>
                  <div className="rounded-xl bg-secondary/30 p-4 text-left text-sm space-y-1">
                    <p><strong>Workspace:</strong> {formData.name as string}</p>
                    <p><strong>Vertical:</strong> {vertical}</p>
                    <p><strong>Auto-classify:</strong> {formData.autoClassify ? "Yes" : "No"}</p>
                    <p><strong>Auto-route:</strong> {formData.autoRoute ? "Yes" : "No"}</p>
                    <p><strong>HITL:</strong> {formData.hitlEnabled ? "Yes" : "No"}</p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <input type="checkbox" id="terms" checked={formData.acceptTerms as boolean}
                      onChange={(e) => update("acceptTerms", e.target.checked)} className="rounded border-border" />
                    <Label htmlFor="terms" className="text-sm">I agree to the Terms of Service</Label>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={prev} disabled={currentStep === 0}>Back</Button>
            <Button onClick={next} disabled={!canProceed() || saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {saving ? "Saving..." : saved ? "Saved!" : currentStep === steps.length - 1 ? "Activate" : "Continue"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
