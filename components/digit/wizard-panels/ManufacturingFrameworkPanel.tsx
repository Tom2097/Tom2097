"use client"

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
        <h3 className="text-lg font-medium">Manufacturing Workspace Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure your manufacturing workspace with industry-specific settings and operational requirements.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="manufacturing-sector">Manufacturing Sector</Label>
          <Select
            value={formData.manufacturingSector as string || ""}
            onValueChange={(value) => update("manufacturingSector", value)}
          >
            <SelectTrigger id="manufacturing-sector">
              <SelectValue placeholder="Select sector" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="automotive">Automotive</SelectItem>
              <SelectItem value="aerospace">Aerospace</SelectItem>
              <SelectItem value="electronics">Electronics</SelectItem>
              <SelectItem value="pharmaceuticals">Pharmaceuticals</SelectItem>
              <SelectItem value="food-beverage">Food & Beverage</SelectItem>
              <SelectItem value="chemicals">Chemicals</SelectItem>
              <SelectItem value="machinery">Industrial Machinery</SelectItem>
              <SelectItem value="consumer-goods">Consumer Goods</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="production-processes">Production Processes</Label>
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
          <Label htmlFor="mes-integration">MES Integration</Label>
          <Select
            value={formData.mesIntegration as string || ""}
            onValueChange={(value) => update("mesIntegration", value)}
          >
            <SelectTrigger id="mes-integration">
              <SelectValue placeholder="Select MES system" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="siemens-opcenter">Siemens Opcenter</SelectItem>
              <SelectItem value="rockwell-factorytalk">Rockwell FactoryTalk</SelectItem>
              <SelectItem value="honeywell-pms">Honeywell PMS</SelectItem>
              <SelectItem value="sap-me">SAP ME</SelectItem>
              <SelectItem value="oracle-manufacturing">Oracle Manufacturing</SelectItem>
              <SelectItem value="other">Other/None</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quality-management">Quality Management</Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="quality-management"
              checked={formData.qualityManagement as boolean || false}
              onCheckedChange={(checked) => update("qualityManagement", checked)}
            />
            <Label htmlFor="quality-management">Enable quality management</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Enables tracking of quality control metrics, defects, and compliance documentation.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="inventory-tracking">Inventory Tracking</Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="inventory-tracking"
              checked={formData.inventoryTracking as boolean || false}
              onCheckedChange={(checked) => update("inventoryTracking", checked)}
            />
            <Label htmlFor="inventory-tracking">Enable inventory tracking</Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="maintenance-management">Maintenance Management</Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="maintenance-management"
              checked={formData.maintenanceManagement as boolean || false}
              onCheckedChange={(checked) => update("maintenanceManagement", checked)}
            />
            <Label htmlFor="maintenance-management">Enable maintenance management</Label>
          </div>
        </div>
      </div>
    </CardContent>
  )
}