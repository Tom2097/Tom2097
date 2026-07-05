"use client"

import { CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface HealthcareFrameworkPanelProps {
  formData: Record<string, unknown>
  update: (key: string, value: unknown) => void
}

export function HealthcareFrameworkPanel({ formData, update }: HealthcareFrameworkPanelProps) {
  return (
    <CardContent className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Healthcare Workspace Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure your healthcare workspace with industry-specific settings and compliance requirements.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="healthcare-specialty">Medical Specialty</Label>
          <Select
            value={formData.healthcareSpecialty as string || ""}
            onValueChange={(value) => update("healthcareSpecialty", value)}
          >
            <SelectTrigger id="healthcare-specialty">
              <SelectValue placeholder="Select specialty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="primary-care">Primary Care</SelectItem>
              <SelectItem value="pediatrics">Pediatrics</SelectItem>
              <SelectItem value="cardiology">Cardiology</SelectItem>
              <SelectItem value="oncology">Oncology</SelectItem>
              <SelectItem value="neurology">Neurology</SelectItem>
              <SelectItem value="orthopedics">Orthopedics</SelectItem>
              <SelectItem value="mental-health">Mental Health</SelectItem>
              <SelectItem value="emergency">Emergency Medicine</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="hipaa-compliance">HIPAA Compliance</Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="hipaa-compliance"
              checked={formData.hipaaCompliance as boolean || false}
              onCheckedChange={(checked) => update("hipaaCompliance", checked)}
            />
            <Label htmlFor="hipaa-compliance">Enable HIPAA compliance features</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Enables additional security and audit features required for HIPAA compliance.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ehr-integration">EHR Integration</Label>
          <Select
            value={formData.ehrIntegration as string || ""}
            onValueChange={(value) => update("ehrIntegration", value)}
          >
            <SelectTrigger id="ehr-integration">
              <SelectValue placeholder="Select EHR system" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="epic">Epic Systems</SelectItem>
              <SelectItem value="cerner">Cerner</SelectItem>
              <SelectItem value="meditech">Meditech</SelectItem>
              <SelectItem value="allscripts">Allscripts</SelectItem>
              <SelectItem value="nextgen">NextGen Healthcare</SelectItem>
              <SelectItem value="other">Other/None</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="patient-data-fields">Patient Data Fields</Label>
          <div className="flex flex-wrap gap-2">
            {[
              "demographics",
              "medical-history",
              "medications",
              "allergies",
              "lab-results",
              "vital-signs",
              "immunizations",
              "appointments"
            ].map((field) => (
              <div key={field} className="flex items-center space-x-2">
                <Switch
                  id={`field-${field}`}
                  checked={(formData.patientDataFields as string[] || []).includes(field)}
                  onCheckedChange={(checked) => {
                    const currentFields = (formData.patientDataFields as string[] || [])
                    if (checked) {
                      update("patientDataFields", [...currentFields, field])
                    } else {
                      update("patientDataFields", currentFields.filter((f) => f !== field))
                    }
                  }}
                />
                <Label htmlFor={`field-${field}`} className="capitalize">
                  {field.replace(/-/g, ' ')}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="appointment-scheduling">Appointment Scheduling</Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="appointment-scheduling"
              checked={formData.appointmentScheduling as boolean || false}
              onCheckedChange={(checked) => update("appointmentScheduling", checked)}
            />
            <Label htmlFor="appointment-scheduling">Enable appointment scheduling</Label>
          </div>
        </div>
      </div>
    </CardContent>
  )
}