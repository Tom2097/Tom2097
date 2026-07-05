"use client"

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
        <h3 className="text-lg font-medium">Legal Workspace Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure your legal workspace with industry-specific settings and compliance requirements.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="legal-specialty">Legal Specialty</Label>
          <Select
            value={formData.legalSpecialty as string || ""}
            onValueChange={(value) => update("legalSpecialty", value)}
          >
            <SelectTrigger id="legal-specialty">
              <SelectValue placeholder="Select specialty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="corporate-law">Corporate Law</SelectItem>
              <SelectItem value="litigation">Litigation</SelectItem>
              <SelectItem value="intellectual-property">Intellectual Property</SelectItem>
              <SelectItem value="real-estate">Real Estate Law</SelectItem>
              <SelectItem value="family-law">Family Law</SelectItem>
              <SelectItem value="criminal-law">Criminal Law</SelectItem>
              <SelectItem value="employment-law">Employment Law</SelectItem>
              <SelectItem value="tax-law">Tax Law</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="document-management">Document Management</Label>
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
          <Label htmlFor="case-management">Case Management</Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="case-management"
              checked={formData.caseManagement as boolean || false}
              onCheckedChange={(checked) => update("caseManagement", checked)}
            />
            <Label htmlFor="case-management">Enable case management</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Enables tracking of legal cases, deadlines, and client matters.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="time-tracking">Time Tracking & Billing</Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="time-tracking"
              checked={formData.timeTracking as boolean || false}
              onCheckedChange={(checked) => update("timeTracking", checked)}
            />
            <Label htmlFor="time-tracking">Enable time tracking & billing</Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-portal">Client Portal</Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="client-portal"
              checked={formData.clientPortal as boolean || false}
              onCheckedChange={(checked) => update("clientPortal", checked)}
            />
            <Label htmlFor="client-portal">Enable client portal</Label>
          </div>
        </div>
      </div>
    </CardContent>
  )
}