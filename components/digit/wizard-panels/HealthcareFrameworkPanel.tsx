"use client"
import { T } from "@/components/i18n/t"

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
        <h3 className="text-lg font-medium"><T>Healthcare Workspace Configuration</T></h3>
        <p className="text-sm text-muted-foreground">
          <T>Configure your healthcare workspace with industry-specific settings and compliance requirements.</T>
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="healthcare-specialty"><T>Medical Specialty</T></Label>
          <Select
            value={formData.healthcareSpecialty as string || ""}
            onValueChange={(value) => update("healthcareSpecialty", value)}
          >
            <SelectTrigger id="healthcare-specialty">
              <SelectValue placeholder="Select specialty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="primary-care"><T>Primary Care</T></SelectItem>
              <SelectItem value="pediatrics"><T>Pediatrics</T></SelectItem>
              <SelectItem value="cardiology"><T>Cardiology</T></SelectItem>
              <SelectItem value="oncology"><T>Oncology</T></SelectItem>
              <SelectItem value="neurology"><T>Neurology</T></SelectItem>
              <SelectItem value="orthopedics"><T>Orthopedics</T></SelectItem>
              <SelectItem value="mental-health"><T>Mental Health</T></SelectItem>
              <SelectItem value="emergency"><T>Emergency Medicine</T></SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="hipaa-compliance"><T>HIPAA Compliance</T></Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="hipaa-compliance"
              checked={formData.hipaaCompliance as boolean || false}
              onCheckedChange={(checked) => update("hipaaCompliance", checked)}
            />
            <Label htmlFor="hipaa-compliance"><T>Enable HIPAA compliance features</T></Label>
          </div>
          <p className="text-sm text-muted-foreground">
            <T>Enables additional security and audit features required for HIPAA compliance.</T>
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ehr-integration"><T>EHR Integration</T></Label>
          <Select
            value={formData.ehrIntegration as string || ""}
            onValueChange={(value) => update("ehrIntegration", value)}
          >
            <SelectTrigger id="ehr-integration">
              <SelectValue placeholder="Select EHR system" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="epic"><T>Epic Systems</T></SelectItem>
              <SelectItem value="cerner"><T>Cerner</T></SelectItem>
              <SelectItem value="meditech"><T>Meditech</T></SelectItem>
              <SelectItem value="allscripts"><T>Allscripts</T></SelectItem>
              <SelectItem value="nextgen"><T>NextGen Healthcare</T></SelectItem>
              <SelectItem value="other"><T>Other/None</T></SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="patient-data-fields"><T>Patient Data Fields</T></Label>
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
          <Label htmlFor="appointment-scheduling"><T>Appointment Scheduling</T></Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="appointment-scheduling"
              checked={formData.appointmentScheduling as boolean || false}
              onCheckedChange={(checked) => update("appointmentScheduling", checked)}
            />
            <Label htmlFor="appointment-scheduling"><T>Enable appointment scheduling</T></Label>
          </div>
        </div>
      </div>
    </CardContent>
  )
}