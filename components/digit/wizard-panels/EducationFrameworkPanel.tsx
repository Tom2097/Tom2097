"use client"
import { T } from "@/components/i18n/t"

import { CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface EducationFrameworkPanelProps {
  formData: Record<string, unknown>
  update: (key: string, value: unknown) => void
}

export function EducationFrameworkPanel({ formData, update }: EducationFrameworkPanelProps) {
  return (
    <CardContent className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-medium"><T>Education Workspace Configuration</T></h3>
        <p className="text-sm text-muted-foreground">
          <T>Configure your education workspace with industry-specific settings and learning management features.</T>
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="education-sector"><T>Education Sector</T></Label>
          <Select
            value={formData.educationSector as string || ""}
            onValueChange={(value) => update("educationSector", value)}
          >
            <SelectTrigger id="education-sector">
              <SelectValue placeholder="Select sector" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="k12">K-12</SelectItem>
              <SelectItem value="higher-ed"><T>Higher Education</T></SelectItem>
              <SelectItem value="vocational"><T>Vocational Training</T></SelectItem>
              <SelectItem value="corporate-training"><T>Corporate Training</T></SelectItem>
              <SelectItem value="online-learning"><T>Online Learning Platform</T></SelectItem>
              <SelectItem value="tutoring"><T>Tutoring Services</T></SelectItem>
              <SelectItem value="test-prep"><T>Test Preparation</T></SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lms-integration"><T>LMS Integration</T></Label>
          <Select
            value={formData.lmsIntegration as string || ""}
            onValueChange={(value) => update("lmsIntegration", value)}
          >
            <SelectTrigger id="lms-integration">
              <SelectValue placeholder="Select LMS system" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="canvas"><T>Canvas</T></SelectItem>
              <SelectItem value="blackboard"><T>Blackboard</T></SelectItem>
              <SelectItem value="moodle"><T>Moodle</T></SelectItem>
              <SelectItem value="google-classroom"><T>Google Classroom</T></SelectItem>
              <SelectItem value="schoology"><T>Schoology</T></SelectItem>
              <SelectItem value="brightspace"><T>Brightspace</T></SelectItem>
              <SelectItem value="other"><T>Other/None</T></SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="student-management"><T>Student Management</T></Label>
          <div className="flex flex-wrap gap-2">
            {[
              "enrollment",
              "attendance",
              "grades",
              "scheduling",
              "behavior-tracking",
              "parent-portal",
              "transcripts",
              "financial-aid"
            ].map((feature) => (
              <div key={feature} className="flex items-center space-x-2">
                <Switch
                  id={`feature-${feature}`}
                  checked={(formData.studentManagementFeatures as string[] || []).includes(feature)}
                  onCheckedChange={(checked) => {
                    const currentFeatures = (formData.studentManagementFeatures as string[] || [])
                    if (checked) {
                      update("studentManagementFeatures", [...currentFeatures, feature])
                    } else {
                      update("studentManagementFeatures", currentFeatures.filter((f) => f !== feature))
                    }
                  }}
                />
                <Label htmlFor={`feature-${feature}`} className="capitalize">
                  {feature.replace(/-/g, ' ')}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="course-management"><T>Course Management</T></Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="course-management"
              checked={formData.courseManagement as boolean || false}
              onCheckedChange={(checked) => update("courseManagement", checked)}
            />
            <Label htmlFor="course-management"><T>Enable course management</T></Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="content-delivery"><T>Content Delivery</T></Label>
          <div className="flex flex-wrap gap-2">
            {[
              "video-lectures",
              "quizzes",
              "assignments",
              "discussion-forums",
              "live-classes",
              "gamification",
              "certifications"
            ].map((method) => (
              <div key={method} className="flex items-center space-x-2">
                <Switch
                  id={`method-${method}`}
                  checked={(formData.contentDeliveryMethods as string[] || []).includes(method)}
                  onCheckedChange={(checked) => {
                    const currentMethods = (formData.contentDeliveryMethods as string[] || [])
                    if (checked) {
                      update("contentDeliveryMethods", [...currentMethods, method])
                    } else {
                      update("contentDeliveryMethods", currentMethods.filter((m) => m !== method))
                    }
                  }}
                />
                <Label htmlFor={`method-${method}`} className="capitalize">
                  {method.replace(/-/g, ' ')}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="analytics-reporting"><T>Analytics & Reporting</T></Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="analytics-reporting"
              checked={formData.analyticsReporting as boolean || false}
              onCheckedChange={(checked) => update("analyticsReporting", checked)}
            />
            <Label htmlFor="analytics-reporting"><T>Enable analytics & reporting</T></Label>
          </div>
        </div>
      </div>
    </CardContent>
  )
}