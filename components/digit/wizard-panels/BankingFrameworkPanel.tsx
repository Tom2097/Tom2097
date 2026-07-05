"use client"

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
        <h3 className="text-lg font-medium">Banking & Finance Workspace Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure your banking workspace with industry-specific settings and compliance requirements.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="banking-sector">Financial Sector</Label>
          <Select
            value={formData.bankingSector as string || ""}
            onValueChange={(value) => update("bankingSector", value)}
          >
            <SelectTrigger id="banking-sector">
              <SelectValue placeholder="Select sector" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="retail-banking">Retail Banking</SelectItem>
              <SelectItem value="corporate-banking">Corporate Banking</SelectItem>
              <SelectItem value="investment-banking">Investment Banking</SelectItem>
              <SelectItem value="asset-management">Asset Management</SelectItem>
              <SelectItem value="insurance">Insurance</SelectItem>
              <SelectItem value="fintech">Fintech</SelectItem>
              <SelectItem value="credit-unions">Credit Unions</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="regulatory-compliance">Regulatory Compliance</Label>
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
          <Label htmlFor="core-banking-integration">Core Banking Integration</Label>
          <Select
            value={formData.coreBankingIntegration as string || ""}
            onValueChange={(value) => update("coreBankingIntegration", value)}
          >
            <SelectTrigger id="core-banking-integration">
              <SelectValue placeholder="Select core banking system" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="temenos">Temenos</SelectItem>
              <SelectItem value="fiserv">Fiserv</SelectItem>
              <SelectItem value="jack-henry">Jack Henry & Associates</SelectItem>
              <SelectItem value="fis">FIS</SelectItem>
              <SelectItem value="oracle-fss">Oracle FSS</SelectItem>
              <SelectItem value="sap">SAP Banking</SelectItem>
              <SelectItem value="other">Other/None</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="transaction-monitoring">Transaction Monitoring</Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="transaction-monitoring"
              checked={formData.transactionMonitoring as boolean || false}
              onCheckedChange={(checked) => update("transactionMonitoring", checked)}
            />
            <Label htmlFor="transaction-monitoring">Enable transaction monitoring</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Enables real-time monitoring of financial transactions for fraud detection and AML compliance.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer-segmentation">Customer Segmentation</Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="customer-segmentation"
              checked={formData.customerSegmentation as boolean || false}
              onCheckedChange={(checked) => update("customerSegmentation", checked)}
            />
            <Label htmlFor="customer-segmentation">Enable customer segmentation</Label>
          </div>
        </div>
      </div>
    </CardContent>
  )
}