"use client"
import { T } from "@/components/i18n/t"

import { CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface BankingFrameworkPanelProps {
  formData: Record<string, unknown>
  update: (key: string, value: unknown) => void
}

export function BankingFrameworkPanel({ formData, update }: BankingFrameworkPanelProps) {
  return (
    <CardContent className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-medium"><T>Banking & Finance Workspace Configuration</T></h3>
        <p className="text-sm text-muted-foreground">
          <T>Configure your banking workspace with industry-specific settings and compliance requirements.</T>
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="banking-sector"><T>Financial Sector</T></Label>
          <Select
            value={formData.bankingSector as string || ""}
            onValueChange={(value) => update("bankingSector", value)}
          >
            <SelectTrigger id="banking-sector">
              <SelectValue placeholder="Select sector" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="retail-banking"><T>Retail Banking</T></SelectItem>
              <SelectItem value="corporate-banking"><T>Corporate Banking</T></SelectItem>
              <SelectItem value="investment-banking"><T>Investment Banking</T></SelectItem>
              <SelectItem value="asset-management"><T>Asset Management</T></SelectItem>
              <SelectItem value="insurance"><T>Insurance</T></SelectItem>
              <SelectItem value="fintech"><T>Fintech</T></SelectItem>
              <SelectItem value="credit-unions"><T>Credit Unions</T></SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="regulatory-compliance"><T>Regulatory Compliance</T></Label>
          <div className="flex flex-wrap gap-2">
            {[
              "aml",
              "kyc",
              "gdpr",
              "basel-iii",
              "dodd-frank",
              "psd2",
              "sox",
              "glba"
            ].map((compliance) => (
              <div key={compliance} className="flex items-center space-x-2">
                <Switch
                  id={`compliance-${compliance}`}
                  checked={(formData.regulatoryCompliance as string[] || []).includes(compliance)}
                  onCheckedChange={(checked) => {
                    const currentCompliance = (formData.regulatoryCompliance as string[] || [])
                    if (checked) {
                      update("regulatoryCompliance", [...currentCompliance, compliance])
                    } else {
                      update("regulatoryCompliance", currentCompliance.filter((c) => c !== compliance))
                    }
                  }}
                />
                <Label htmlFor={`compliance-${compliance}`} className="capitalize">
                  {compliance.toUpperCase()}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="core-banking-integration"><T>Core Banking Integration</T></Label>
          <Select
            value={formData.coreBankingIntegration as string || ""}
            onValueChange={(value) => update("coreBankingIntegration", value)}
          >
            <SelectTrigger id="core-banking-integration">
              <SelectValue placeholder="Select core banking system" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="temenos"><T>Temenos</T></SelectItem>
              <SelectItem value="fiserv"><T>Fiserv</T></SelectItem>
              <SelectItem value="jack-henry"><T>Jack Henry & Associates</T></SelectItem>
              <SelectItem value="fis"><T>FIS</T></SelectItem>
              <SelectItem value="oracle-fss"><T>Oracle FSS</T></SelectItem>
              <SelectItem value="sap"><T>SAP Banking</T></SelectItem>
              <SelectItem value="other"><T>Other/None</T></SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="transaction-monitoring"><T>Transaction Monitoring</T></Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="transaction-monitoring"
              checked={formData.transactionMonitoring as boolean || false}
              onCheckedChange={(checked) => update("transactionMonitoring", checked)}
            />
            <Label htmlFor="transaction-monitoring"><T>Enable transaction monitoring</T></Label>
          </div>
          <p className="text-sm text-muted-foreground">
            <T>Enables real-time monitoring of financial transactions for fraud detection and AML compliance.</T>
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer-segmentation"><T>Customer Segmentation</T></Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="customer-segmentation"
              checked={formData.customerSegmentation as boolean || false}
              onCheckedChange={(checked) => update("customerSegmentation", checked)}
            />
            <Label htmlFor="customer-segmentation"><T>Enable customer segmentation</T></Label>
          </div>
        </div>
      </div>
    </CardContent>
  )
}