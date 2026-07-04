"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Globe, Check, Loader2, AlertCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function DomainVerification() {
  const [domain, setDomain] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<{ verified: boolean; message: string } | null>(null)

  const handleVerify = async () => {
    if (!domain) return
    setVerifying(true)
    setResult(null)
    try {
      const res = await fetch("/api/v1/enterprise/verify-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      })
      const data = await res.json()
      setResult({ verified: data.verified, message: data.message || (data.verified ? "Domain verified successfully" : "Domain verification failed") })
    } catch {
      setResult({ verified: false, message: "Verification request failed" })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <Card className="p-6 border-border/50 bg-card/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Globe className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Domain Verification</h3>
          <p className="text-xs text-muted-foreground">Verify your company domain to unlock enterprise features</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            placeholder="yourcompany.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={verifying}
          />
        </div>
        <Button onClick={handleVerify} disabled={!domain || verifying}>
          {verifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Globe className="w-4 h-4 mr-2" />}
          Verify
        </Button>
      </div>

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 flex items-center gap-2 p-3 rounded-lg text-sm ${
          result.verified ? "bg-chart-2/10 text-chart-2" : "bg-destructive/10 text-destructive"
        }`}>
          {result.verified ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {result.message}
        </motion.div>
      )}

      <div className="mt-4 p-3 rounded-lg bg-muted/30">
        <p className="text-xs font-medium text-foreground mb-2">To verify, add this TXT record to your DNS:</p>
        <code className="text-xs bg-background p-2 rounded block break-all">digit-verify={domain ? domain.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase() : "yourdomain"}</code>
      </div>
    </Card>
  )
}
