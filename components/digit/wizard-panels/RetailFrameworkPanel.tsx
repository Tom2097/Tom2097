"use client"
import { T } from "@/components/i18n/t"

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
        <h3 className="text-lg font-medium"><T>Retail Workspace Configuration</T></h3>
        <p className="text-sm text-muted-foreground">
          <T>Configure your retail workspace with industry-specific settings and customer engagement features.</T>
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="retail-sector"><T>Retail Sector</T></Label>
          <Select
            value={formData.retailSector as string || ""}
            onValueChange={(value) => update("retailSector", value)}
          >
            <SelectTrigger id="retail-sector">
              <SelectValue placeholder="Select sector" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ecommerce"><T>E-commerce</T></SelectItem>
              <SelectItem value="brick-and-mortar"><T>Brick & Mortar</T></SelectItem>
              <SelectItem value="omnichannel"><T>Omnichannel</T></SelectItem>
              <SelectItem value="grocery"><T>Grocery</T></SelectItem>
              <SelectItem value="apparel"><T>Apparel & Fashion</T></SelectItem>
              <SelectItem value="electronics"><T>Electronics</T></SelectItem>
              <SelectItem value="home-goods"><T>Home Goods</T></SelectItem>
              <SelectItem value="luxury"><T>Luxury Goods</T></SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pos-integration"><T>POS Integration</T></Label>
          <Select
            value={formData.posIntegration as string || ""}
            onValueChange={(value) => update("posIntegration", value)}
          >
            <SelectTrigger id="pos-integration">
              <SelectValue placeholder="Select POS system" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="square"><T>Square</T></SelectItem>
              <SelectItem value="clover"><T>Clover</T></SelectItem>
              <SelectItem value="shopify-pos"><T>Shopify POS</T></SelectItem>
              <SelectItem value="lightspeed"><T>Lightspeed</T></SelectItem>
              <SelectItem value="toast"><T>Toast (for restaurants)</T></SelectItem>
              <SelectItem value="other"><T>Other/None</T></SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="inventory-management"><T>Inventory Management</T></Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="inventory-management"
              checked={formData.inventoryManagement as boolean || false}
              onCheckedChange={(checked) => update("inventoryManagement", checked)}
            />
            <Label htmlFor="inventory-management"><T>Enable inventory management</T></Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer-loyalty"><T>Customer Loyalty Program</T></Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="customer-loyalty"
              checked={formData.customerLoyalty as boolean || false}
              onCheckedChange={(checked) => update("customerLoyalty", checked)}
            />
            <Label htmlFor="customer-loyalty"><T>Enable loyalty program</T></Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="omnichannel-capabilities"><T>Omnichannel Capabilities</T></Label>
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
          <Label htmlFor="sales-analytics"><T>Sales Analytics</T></Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="sales-analytics"
              checked={formData.salesAnalytics as boolean || false}
              onCheckedChange={(checked) => update("salesAnalytics", checked)}
            />
            <Label htmlFor="sales-analytics"><T>Enable sales analytics</T></Label>
          </div>
        </div>
      </div>
    </CardContent>
  )
}