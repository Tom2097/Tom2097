"use client"
import { T } from "@/components/i18n/t"

import { CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ManufacturingFrameworkPanelProps {
  formData: Record<string, unknown>
  update: (key: string, value: unknown) => void
}

export function ManufacturingFrameworkPanel({ formData, update }: ManufacturingFrameworkPanelProps) {
  return (
    <CardContent className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-medium"><T>Manufacturing Workspace Configuration</T></h3>
        <p className="text-sm text-muted-foreground">
          <T>Configure your manufacturing workspace with industry-specific settings and operational requirements.</T>
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="manufacturing-sector"><T>Manufacturing Sector</T></Label>
          <Select
            value={formData.manufacturingSector as string || ""}
            onValueChange={(value) => update("manufacturingSector", value)}
          >
            <SelectTrigger id="manufacturing-sector">
              <SelectValue placeholder="Select sector" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="automotive"><T>Automotive</T></SelectItem>
              <SelectItem value="aerospace"><T>Aerospace</T></SelectItem>
              <SelectItem value="electronics"><T>Electronics</T></SelectItem>
              <SelectItem value="pharmaceuticals"><T>Pharmaceuticals</T></SelectItem>
              <SelectItem value="food-beverage"><T>Food & Beverage</T></SelectItem>
              <SelectItem value="chemicals"><T>Chemicals</T></SelectItem>
              <SelectItem value="machinery"><T>Industrial Machinery</T></SelectItem>
              <SelectItem value="consumer-goods"><T>Consumer Goods</T></SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="production-processes"><T>Production Processes</T></Label>
          <div className="flex flex-wrap gap-2">
            {[
              "assembly",
              "machining",
              "molding",
              "casting",
              "welding",
              "3d-printing",
              "quality-control",
              "packaging"
            ].map((process) => (
              <div key={process} className="flex items-center space-x-2">
                <Switch
                  id={`process-${process}`}
                  checked={(formData.productionProcesses as string[] || []).includes(process)}
                  onCheckedChange={(checked) => {
                    const currentProcesses = (formData.productionProcesses as string[] || [])
                    if (checked) {
                      update("productionProcesses", [...currentProcesses, process])
                    } else {
                      update("productionProcesses", currentProcesses.filter((p) => p !== process))
                    }
                  }}
                />
                <Label htmlFor={`process-${process}`} className="capitalize">
                  {process.replace(/-/g, ' ')}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mes-integration"><T>MES Integration</T></Label>
          <Select
            value={formData.mesIntegration as string || ""}
            onValueChange={(value) => update("mesIntegration", value)}
          >
            <SelectTrigger id="mes-integration">
              <SelectValue placeholder="Select MES system" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="siemens-opcenter"><T>Siemens Opcenter</T></SelectItem>
              <SelectItem value="rockwell-factorytalk"><T>Rockwell FactoryTalk</T></SelectItem>
              <SelectItem value="honeywell-pms"><T>Honeywell PMS</T></SelectItem>
              <SelectItem value="sap-me"><T>SAP ME</T></SelectItem>
              <SelectItem value="oracle-manufacturing"><T>Oracle Manufacturing</T></SelectItem>
              <SelectItem value="other"><T>Other/None</T></SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quality-management"><T>Quality Management</T></Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="quality-management"
              checked={formData.qualityManagement as boolean || false}
              onCheckedChange={(checked) => update("qualityManagement", checked)}
            />
            <Label htmlFor="quality-management"><T>Enable quality management</T></Label>
          </div>
          <p className="text-sm text-muted-foreground">
            <T>Enables tracking of quality control metrics, defects, and compliance documentation.</T>
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="inventory-tracking"><T>Inventory Tracking</T></Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="inventory-tracking"
              checked={formData.inventoryTracking as boolean || false}
              onCheckedChange={(checked) => update("inventoryTracking", checked)}
            />
            <Label htmlFor="inventory-tracking"><T>Enable inventory tracking</T></Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="maintenance-management"><T>Maintenance Management</T></Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="maintenance-management"
              checked={formData.maintenanceManagement as boolean || false}
              onCheckedChange={(checked) => update("maintenanceManagement", checked)}
            />
            <Label htmlFor="maintenance-management"><T>Enable maintenance management</T></Label>
          </div>
        </div>
      </div>
    </CardContent>
  )
}