"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Shield, Package, BarChart3, Wifi } from "lucide-react"

interface PanelProps {
  data: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}

export function ComplianceFrameworkPanel({ data, onChange }: PanelProps) {
  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Shield className="h-4 w-4 text-teal-500" />Compliance Frameworks</h3>
      {["GMP", "ISO 9001", "ISO 27001", "GDPR", "DPDP", "HIPAA", "SOX", "FDA 21 CFR Part 11"].map((fw) => (
        <div key={fw} className="flex items-center justify-between"><Label>{fw}</Label>
          <Switch checked={(data[fw] as boolean) ?? false} onCheckedChange={(v) => onChange(fw, v)} /></div>
      ))}
      <div className="space-y-2 pt-2"><Label>Audit Calendar (days)</Label>
        <Input type="number" value={(data.auditCalendarDays as string) ?? "365"} onChange={(e) => onChange("auditCalendarDays", e.target.value)} /></div>
      <div className="space-y-2"><Label>CAPA SLA (days)</Label>
        <Input type="number" value={(data.capaSlaDays as string) ?? "30"} onChange={(e) => onChange("capaSlaDays", e.target.value)} /></div>
    </div>
  )
}

export function ResourcesFrameworkPanel({ data, onChange }: PanelProps) {
  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Package className="h-4 w-4 text-blue-500" />Asset Categories</h3>
      {["Equipment", "Vehicles", "IT Assets", "Tools", "Facilities", "Inventory"].map((cat) => (
        <div key={cat} className="flex items-center justify-between"><Label>{cat}</Label>
          <Switch checked={(data[cat] as boolean) ?? false} onCheckedChange={(v) => onChange(cat, v)} /></div>
      ))}
      <div className="space-y-2 pt-2"><Label>Reorder Point (units)</Label>
        <Input type="number" value={(data.reorderPoint as string) ?? "10"} onChange={(e) => onChange("reorderPoint", e.target.value)} /></div>
      <div className="space-y-2"><Label>Telemetry Feed URL</Label>
        <Input value={(data.telemetryFeed as string) ?? ""} onChange={(e) => onChange("telemetryFeed", e.target.value)} placeholder="mqtt://..." /></div>
    </div>
  )
}

export function PerformanceFrameworkPanel({ data, onChange }: PanelProps) {
  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><BarChart3 className="h-4 w-4 text-amber-500" />Metrics & KPIs</h3>
      {["Revenue", "Cost", "Usage", "Uptime", "Response Time", "Conversion"].map((m) => (
        <div key={m} className="flex items-center justify-between"><Label>{m}</Label>
          <Input className="w-24" type="number" placeholder="Target" value={(data[`target_${m}`] as string) ?? ""}
            onChange={(e) => onChange(`target_${m}`, e.target.value)} /></div>
      ))}
      <div className="space-y-2 pt-2"><Label>North Star Metric</Label>
        <Select value={(data.northStar as string) ?? ""} onValueChange={(v) => onChange("northStar", v)}>
          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            {["Revenue", "Customer Satisfaction", "Uptime", "Throughput"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select></div>
    </div>
  )
}

export function OperationalFrameworkPanel({ data, onChange }: PanelProps) {
  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Wifi className="h-4 w-4 text-indigo-500" />Intake Doors</h3>
      {["Email", "WhatsApp", "Voice Notes", "Photo/Scan", "Audio Recording", "URL Clip", "Bulk Upload"].map((door) => (
        <div key={door} className="flex items-center justify-between"><Label>{door}</Label>
          <Switch checked={(data[door] as boolean) ?? false} onCheckedChange={(v) => onChange(door, v)} /></div>
      ))}
      <div className="space-y-2 pt-2"><Label>Auto-Routing Target</Label>
        <Select value={(data.routingTarget as string) ?? "compliance"} onValueChange={(v) => onChange("routingTarget", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="compliance">Compliance</SelectItem>
            <SelectItem value="resources">Resources</SelectItem>
            <SelectItem value="performance">Performance</SelectItem>
          </SelectContent>
        </Select></div>
      <div className="space-y-2"><Label>Human-in-the-Loop Confidence Threshold (%)</Label>
        <Input type="number" min={0} max={100} value={(data.hitlThreshold as string) ?? "80"}
          onChange={(e) => onChange("hitlThreshold", e.target.value)} /></div>
    </div>
  )
}
