"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Check, Building2, Users, Bell, Shield, Database, Rocket } from "lucide-react"

const steps = [
  { id: "organization", title: "Organization", icon: Building2 },
  { id: "team", title: "Team Setup", icon: Users },
  { id: "notifications", title: "Notifications", icon: Bell },
  { id: "security", title: "Security", icon: Shield },
  { id: "data", title: "Data Sources", icon: Database },
  { id: "launch", title: "Launch", icon: Rocket },
]

const industries = [
  "Technology", "Healthcare", "Finance", "Legal", "Education",
  "Manufacturing", "Retail", "Real Estate", "Energy", "Media",
]

interface SetupWizardProps {
  onComplete: () => void
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState({
    name: "",
    industry: "",
    size: "",
    teamSize: "1-10",
    emailNotifications: true,
    slackWebhook: "",
    mfaEnabled: true,
    sessionTimeout: "60",
    importData: false,
    acceptTerms: false,
  })

  const update = (key: keyof typeof formData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0: return formData.name.trim().length > 0 && formData.industry.length > 0
      case 4: return true
      case 5: return formData.acceptTerms
      default: return true
    }
  }

  const next = () => {
    if (currentStep < steps.length - 1) setCurrentStep((s) => s + 1)
    else onComplete()
  }

  const prev = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1)
  }

  const Step = steps[currentStep]

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
                    <Label htmlFor="org-name">Organization Name</Label>
                    <Input id="org-name" placeholder="Acme Inc." value={formData.name} onChange={(e) => update("name", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Industry</Label>
                    <Select value={formData.industry} onValueChange={(v) => update("industry", v)}>
                      <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                      <SelectContent>
                        {industries.map((ind) => <SelectItem key={ind} value={ind.toLowerCase()}>{ind}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Company Size</Label>
                    <Select value={formData.size} onValueChange={(v) => update("size", v)}>
                      <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="startup">1-10 employees</SelectItem>
                        <SelectItem value="small">11-50 employees</SelectItem>
                        <SelectItem value="mid">51-200 employees</SelectItem>
                        <SelectItem value="large">201-1000 employees</SelectItem>
                        <SelectItem value="enterprise">1000+ employees</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {currentStep === 1 && (
                <div className="space-y-2">
                  <Label>Team Size</Label>
                  <Select value={formData.teamSize} onValueChange={(v) => update("teamSize", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-10">1-10 members</SelectItem>
                      <SelectItem value="11-50">11-50 members</SelectItem>
                      <SelectItem value="51-200">51-200 members</SelectItem>
                      <SelectItem value="200+">200+ members</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Email Notifications</Label>
                    <Switch checked={formData.emailNotifications} onCheckedChange={(v) => update("emailNotifications", v)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Slack Webhook URL (optional)</Label>
                    <Input placeholder="https://hooks.slack.com/..." value={formData.slackWebhook} onChange={(e) => update("slackWebhook", e.target.value)} />
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Require Multi-Factor Auth</Label>
                    <Switch checked={formData.mfaEnabled} onCheckedChange={(v) => update("mfaEnabled", v)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Session Timeout (minutes)</Label>
                    <Select value={formData.sessionTimeout} onValueChange={(v) => update("sessionTimeout", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="480">8 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Import existing data</Label>
                    <Switch checked={formData.importData} onCheckedChange={(v) => update("importData", v)} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    You can connect external data sources later from the Settings panel.
                  </p>
                </div>
              )}

              {currentStep === 5 && (
                <div className="space-y-4 text-center">
                  <Rocket className="h-12 w-12 mx-auto text-primary" />
                  <p className="text-lg font-medium">Ready to launch!</p>
                  <p className="text-sm text-muted-foreground">
                    Your workspace is configured. You can change any setting later.
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="terms"
                      checked={formData.acceptTerms}
                      onChange={(e) => update("acceptTerms", e.target.checked)}
                      className="rounded border-border"
                    />
                    <Label htmlFor="terms" className="text-sm">
                      I agree to the Terms of Service and Privacy Policy
                    </Label>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={prev} disabled={currentStep === 0}>
              Back
            </Button>
            <Button onClick={next} disabled={!canProceed()}>
              {currentStep === steps.length - 1 ? "Get Started" : "Continue"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
