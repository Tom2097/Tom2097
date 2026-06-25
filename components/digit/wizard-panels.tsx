"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Shield, Package, BarChart3, Wifi, Plus, X, Gauge, AlertTriangle, Bell, Users, Clock, FileCheck } from "lucide-react"

interface PanelProps {
  data: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}

export function ComplianceFrameworkPanel({ data, onChange }: PanelProps) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
          <Shield className="h-4 w-4 text-teal-500" />Regulatory Frameworks
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {([
            ["GMP", "Good Manufacturing Practice"],
            ["ISO 9001", "Quality Management"],
            ["ISO 27001", "Info Security"],
            ["GDPR", "Data Protection"],
            ["DPDP", "Digital Personal Data"],
            ["HIPAA", "Healthcare Privacy"],
            ["SOX", "Financial Controls"],
            ["FDA 21 CFR Part 11", "Electronic Records"],
          ] as [string, string][]).map(([fw, desc]) => (
            <div key={fw} className="flex items-center justify-between p-2 rounded-lg border border-border/50">
              <div className="flex flex-col">
                <span className="text-xs font-medium">{fw}</span>
                <span className="text-[10px] text-muted-foreground">{desc}</span>
              </div>
              <Switch checked={(data[fw] as boolean) ?? false} onCheckedChange={(v) => onChange(fw, v)} />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-1 text-xs"><Clock className="h-3 w-3 text-teal-500" />Audit Calendar (days)</Label>
          <Input type="number" value={(data.auditCalendarDays as string) ?? "365"} onChange={(e) => onChange("auditCalendarDays", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1 text-xs"><AlertTriangle className="h-3 w-3 text-teal-500" />CAPA SLA (days)</Label>
          <Input type="number" value={(data.capaSlaDays as string) ?? "30"} onChange={(e) => onChange("capaSlaDays", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">Risk Level Threshold</Label>
          <Select value={(data.riskThreshold as string) ?? "medium"} onValueChange={(v) => onChange("riskThreshold", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low — Flag all deviations</SelectItem>
              <SelectItem value="medium">Medium — Moderate severity +</SelectItem>
              <SelectItem value="high">High — Critical only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Review Frequency</Label>
          <Select value={(data.reviewFrequency as string) ?? "quarterly"} onValueChange={(v) => onChange("reviewFrequency", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="semi_annual">Semi-Annual</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between p-3 rounded-lg bg-teal-500/5 border border-teal-500/10">
        <div className="flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-teal-500" />
          <span className="text-xs font-medium">Auto-generate audit reports</span>
        </div>
        <Switch checked={(data.autoAuditReports as boolean) ?? true} onCheckedChange={(v) => onChange("autoAuditReports", v)} />
      </div>
    </div>
  )
}

export function ResourcesFrameworkPanel({ data, onChange }: PanelProps) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
          <Package className="h-4 w-4 text-blue-500" />Asset Categories
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {([
            ["Equipment", "Machinery & tools"],
            ["Vehicles", "Fleet management"],
            ["IT Assets", "Hardware & software"],
            ["Tools", "Portable equipment"],
            ["Facilities", "Buildings & sites"],
            ["Inventory", "Stock & materials"],
          ] as [string, string][]).map(([cat, desc]) => (
            <div key={cat} className="flex items-center justify-between p-2 rounded-lg border border-border/50">
              <div className="flex flex-col">
                <span className="text-xs font-medium">{cat}</span>
                <span className="text-[10px] text-muted-foreground">{desc}</span>
              </div>
              <Switch checked={(data[cat] as boolean) ?? false} onCheckedChange={(v) => onChange(cat, v)} />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">Reorder Point</Label>
          <Input type="number" value={(data.reorderPoint as string) ?? "10"} onChange={(e) => onChange("reorderPoint", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Safety Stock</Label>
          <Input type="number" value={(data.safetyStock as string) ?? "5"} onChange={(e) => onChange("safetyStock", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Lead Time (days)</Label>
          <Input type="number" value={(data.leadTimeDays as string) ?? "14"} onChange={(e) => onChange("leadTimeDays", e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1 text-xs"><Wifi className="h-3 w-3 text-blue-500" />Telemetry / IoT Feed URL</Label>
        <Input value={(data.telemetryFeed as string) ?? ""} onChange={(e) => onChange("telemetryFeed", e.target.value)} placeholder="mqtt://broker.example.com:1883/topic" />
      </div>

      <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-medium">Low-stock alerts</span>
        </div>
        <Switch checked={(data.lowStockAlerts as boolean) ?? true} onCheckedChange={(v) => onChange("lowStockAlerts", v)} />
      </div>
    </div>
  )
}

export function PerformanceFrameworkPanel({ data, onChange }: PanelProps) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
          <BarChart3 className="h-4 w-4 text-amber-500" />Metrics & KPIs
        </h3>
        <div className="space-y-2">
          {([
            ["Revenue", "$", "Monthly recurring revenue target"],
            ["Cost", "$", "Operational cost budget"],
            ["Usage", "%", "Platform utilization target"],
            ["Uptime", "%", "System availability SLA"],
            ["Response Time", "ms", "Average response time target"],
            ["Conversion", "%", "Conversion rate target"],
          ] as [string, string, string][]).map(([m, unit, hint]) => (
            <div key={m} className="flex items-center justify-between p-2 rounded-lg border border-border/50">
              <div className="flex flex-col">
                <span className="text-xs font-medium">{m}</span>
                <span className="text-[10px] text-muted-foreground">{hint}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{unit}</span>
                <Input className="w-20 h-7 text-xs" type="number" placeholder="Target"
                  value={(data[`target_${m}`] as string) ?? ""}
                  onChange={(e) => onChange(`target_${m}`, e.target.value)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">North Star Metric</Label>
          <Select value={(data.northStar as string) ?? ""} onValueChange={(v) => onChange("northStar", v)}>
            <SelectTrigger><SelectValue placeholder="Select primary metric" /></SelectTrigger>
            <SelectContent>
              {["Revenue", "Customer Satisfaction", "Uptime", "Throughput", "Efficiency", "Quality Score"].map((m) =>
                <SelectItem key={m} value={m}>{m}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Reporting Period</Label>
          <Select value={(data.reportingPeriod as string) ?? "monthly"} onValueChange={(v) => onChange("reportingPeriod", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-medium">Anomaly detection alerts</span>
        </div>
        <Switch checked={(data.anomalyAlerts as boolean) ?? true} onCheckedChange={(v) => onChange("anomalyAlerts", v)} />
      </div>
    </div>
  )
}

export function OperationalFrameworkPanel({ data, onChange }: PanelProps) {
  const intakeDoors = ["Email", "WhatsApp", "Voice Notes", "Photo/Scan", "Audio Recording", "URL Clip", "Bulk Upload", "Slack", "Teams", "Webhook"]

  return (
    <div className="space-y-5">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
          <Wifi className="h-4 w-4 text-indigo-500" />Intake Doors
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {intakeDoors.map((door) => (
            <div key={door} className="flex items-center justify-between p-2 rounded-lg border border-border/50">
              <span className="text-xs font-medium">{door}</span>
              <Switch checked={(data[door] as boolean) ?? false} onCheckedChange={(v) => onChange(door, v)} />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">Auto-Routing Target</Label>
          <Select value={(data.routingTarget as string) ?? "compliance"} onValueChange={(v) => onChange("routingTarget", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="compliance">Compliance</SelectItem>
              <SelectItem value="resources">Resources</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
              <SelectItem value="operational">Operational</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">HITL Confidence Threshold (%)</Label>
          <Input type="number" min={0} max={100} value={(data.hitlThreshold as string) ?? "80"}
            onChange={(e) => onChange("hitlThreshold", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">Max File Size (MB)</Label>
          <Input type="number" value={(data.maxFileSizeMB as string) ?? "25"} onChange={(e) => onChange("maxFileSizeMB", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Supported Formats</Label>
          <Input value={(data.supportedFormats as string) ?? "pdf,docx,jpg,png,txt,csv,xlsx"}
            onChange={(e) => onChange("supportedFormats", e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-500" />
          <span className="text-xs font-medium">Auto-assign to team based on classification</span>
        </div>
        <Switch checked={(data.autoAssign as boolean) ?? true} onCheckedChange={(v) => onChange("autoAssign", v)} />
      </div>
    </div>
  )
}
