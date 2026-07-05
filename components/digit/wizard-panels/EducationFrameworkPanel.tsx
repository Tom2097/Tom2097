"use client"

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
        <h3 className="text-lg font-medium">Education Workspace Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure your education workspace with industry-specific settings and learning management features.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="education-sector">Education Sector</Label>
          <Select
            value={formData.educationSector as string || ""}
            onValueChange={(value) => update("educationSector", value)}
          >
            <SelectTrigger id="education-sector">
              <SelectValue placeholder="Select sector" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="k12">K-12</SelectItem>
              <SelectItem value="higher-ed">Higher Education</SelectItem>
              <SelectItem value="vocational">Vocational Training</SelectItem>
              <SelectItem value="corporate-training">Corporate Training</SelectItem>
              <SelectItem value="online-learning">Online Learning Platform</SelectItem>
              <SelectItem value="tutoring">Tutoring Services</SelectItem>
              <SelectItem value="test-prep">Test Preparation</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lms-integration">LMS Integration</Label>
          <Select
            value={formData.lmsIntegration as string || ""}
            onValueChange={(value) => update("lmsIntegration", value)}
          >
            <SelectTrigger id="lms-integration">
              <SelectValue placeholder="Select LMS system" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="canvas">Canvas</SelectItem>
              <SelectItem value="blackboard">Blackboard</SelectItem>
              <SelectItem value="moodle">Moodle</SelectItem>
              <SelectItem value="google-classroom">Google Classroom</SelectItem>
              <SelectItem value="schoology">Schoology</SelectItem>
              <SelectItem value="brightspace">Brightspace</SelectItem>
              <SelectItem value="other">Other/None</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="student-management">Student Management</Label>
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
          <Label htmlFor="course-management">Course Management</Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="course-management"
              checked={formData.courseManagement as boolean || false}
              onCheckedChange={(checked) => update("courseManagement", checked)}
            />
            <Label htmlFor="course-management">Enable course management</Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="content-delivery">Content Delivery</Label>
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
          <Label htmlFor="analytics-reporting">Analytics & Reporting</Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="analytics-reporting"
              checked={formData.analyticsReporting as boolean || false}
              onCheckedChange={(checked) => update("analyticsReporting", checked)}
            />
            <Label htmlFor="analytics-reporting">Enable analytics & reporting</Label>
          </div>
        </div>
      </div>
    </CardContent>
  )
}