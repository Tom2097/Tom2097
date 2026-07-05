"use client"

import { CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface RetailFrameworkPanelProps {
  formData: Record<string, unknown>
  update: (key: string, value: unknown) => void
}

export function RetailFrameworkPanel({ formData, update }: RetailFrameworkPanelProps) {
  return (
    <CardContent className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Retail Workspace Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure your retail workspace with industry-specific settings and customer engagement features.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="retail-sector">Retail Sector</Label>
          <Select
            value={formData.retailSector as string || ""}
            onValueChange={(value) => update("retailSector", value)}
          >
            <SelectTrigger id="retail-sector">
              <SelectValue placeholder="Select sector" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ecommerce">E-commerce</SelectItem>
              <SelectItem value="brick-and-mortar">Brick & Mortar</SelectItem>
              <SelectItem value="omnichannel">Omnichannel</SelectItem>
              <SelectItem value="grocery">Grocery</SelectItem>
              <SelectItem value="apparel">Apparel & Fashion</SelectItem>
              <SelectItem value="electronics">Electronics</SelectItem>
              <SelectItem value="home-goods">Home Goods</SelectItem>
              <SelectItem value="luxury">Luxury Goods</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pos-integration">POS Integration</Label>
          <Select
            value={formData.posIntegration as string || ""}
            onValueChange={(value) => update("posIntegration", value)}
          >
            <SelectTrigger id="pos-integration">
              <SelectValue placeholder="Select POS system" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="square">Square</SelectItem>
              <SelectItem value="clover">Clover</SelectItem>
              <SelectItem value="shopify-pos">Shopify POS</SelectItem>
              <SelectItem value="lightspeed">Lightspeed</SelectItem>
              <SelectItem value="toast">Toast (for restaurants)</SelectItem>
              <SelectItem value="other">Other/None</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="inventory-management">Inventory Management</Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="inventory-management"
              checked={formData.inventoryManagement as boolean || false}
              onCheckedChange={(checked) => update("inventoryManagement", checked)}
            />
            <Label htmlFor="inventory-management">Enable inventory management</Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer-loyalty">Customer Loyalty Program</Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="customer-loyalty"
              checked={formData.customerLoyalty as boolean || false}
              onCheckedChange={(checked) => update("customerLoyalty", checked)}
            />
            <Label htmlFor="customer-loyalty">Enable loyalty program</Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="omnichannel-capabilities">Omnichannel Capabilities</Label>
          <div className="flex flex-wrap gap-2">
            {[
              "online-store",
              "mobile-app",
              "in-store-pickup",
              "curbside-pickup",
              "ship-from-store",
              "return-management",
              "unified-customer-view"
            ].map((capability) => (
              <div key={capability} className="flex items-center space-x-2">
                <Switch
                  id={`capability-${capability}`}
                  checked={(formData.omnichannelCapabilities as string[] || []).includes(capability)}
                  onCheckedChange={(checked) => {
                    const currentCapabilities = (formData.omnichannelCapabilities as string[] || [])
                    if (checked) {
                      update("omnichannelCapabilities", [...currentCapabilities, capability])
                    } else {
                      update("omnichannelCapabilities", currentCapabilities.filter((c) => c !== capability))
                    }
                  }}
                />
                <Label htmlFor={`capability-${capability}`} className="capitalize">
                  {capability.replace(/-/g, ' ')}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sales-analytics">Sales Analytics</Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="sales-analytics"
              checked={formData.salesAnalytics as boolean || false}
              onCheckedChange={(checked) => update("salesAnalytics", checked)}
            />
            <Label htmlFor="sales-analytics">Enable sales analytics</Label>
          </div>
        </div>
      </div>
    </CardContent>
  )
}