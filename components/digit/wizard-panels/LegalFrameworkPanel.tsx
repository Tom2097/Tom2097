"use client"
import { T } from "@/components/i18n/t"

import { CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface LegalFrameworkPanelProps {
  formData: Record<string, unknown>
  update: (key: string, value: unknown) => void
}

export function LegalFrameworkPanel({ formData, update }: LegalFrameworkPanelProps) {
  return (
    <CardContent className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-medium"><T>Legal Workspace Configuration</T></h3>
        <p className="text-sm text-muted-foreground">
          <T>Configure your legal workspace with industry-specific settings and compliance requirements.</T>
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="legal-specialty"><T>Legal Specialty</T></Label>
          <Select
            value={formData.legalSpecialty as string || ""}
            onValueChange={(value) => update("legalSpecialty", value)}
          >
            <SelectTrigger id="legal-specialty">
              <SelectValue placeholder="Select specialty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="corporate-law"><T>Corporate Law</T></SelectItem>
              <SelectItem value="litigation"><T>Litigation</T></SelectItem>
              <SelectItem value="intellectual-property"><T>Intellectual Property</T></SelectItem>
              <SelectItem value="real-estate"><T>Real Estate Law</T></SelectItem>
              <SelectItem value="family-law"><T>Family Law</T></SelectItem>
              <SelectItem value="criminal-law"><T>Criminal Law</T></SelectItem>
              <SelectItem value="employment-law"><T>Employment Law</T></SelectItem>
              <SelectItem value="tax-law"><T>Tax Law</T></SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="document-management"><T>Document Management</T></Label>
          <div className="flex flex-wrap gap-2">
            {[
              "contracts",
              "pleadings",
              "briefs",
              "agreements",
              "discovery",
              "research",
              "correspondence",
              "court-forms"
            ].map((docType) => (
              <div key={docType} className="flex items-center space-x-2">
                <Switch
                  id={`doc-${docType}`}
                  checked={(formData.documentTypes as string[] || []).includes(docType)}
                  onCheckedChange={(checked) => {
                    const currentDocTypes = (formData.documentTypes as string[] || [])
                    if (checked) {
                      update("documentTypes", [...currentDocTypes, docType])
                    } else {
                      update("documentTypes", currentDocTypes.filter((d) => d !== docType))
                    }
                  }}
                />
                <Label htmlFor={`doc-${docType}`} className="capitalize">
                  {docType.replace(/-/g, ' ')}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="case-management"><T>Case Management</T></Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="case-management"
              checked={formData.caseManagement as boolean || false}
              onCheckedChange={(checked) => update("caseManagement", checked)}
            />
            <Label htmlFor="case-management">Enable case management</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            <T>Enables tracking of legal cases, deadlines, and client matters.</T>
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="time-tracking"><T>Time Tracking & Billing</T></Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="time-tracking"
              checked={formData.timeTracking as boolean || false}
              onCheckedChange={(checked) => update("timeTracking", checked)}
            />
            <Label htmlFor="time-tracking"><T>Enable time tracking & billing</T></Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-portal"><T>Client Portal</T></Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="client-portal"
              checked={formData.clientPortal as boolean || false}
              onCheckedChange={(checked) => update("clientPortal", checked)}
            />
            <Label htmlFor="client-portal"><T>Enable client portal</T></Label>
          </div>
        </div>
      </div>
    </CardContent>
  )
}