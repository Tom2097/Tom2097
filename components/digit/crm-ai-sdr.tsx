"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Building2, Globe, Users, Briefcase, TrendingUp, Loader2, Search } from "lucide-react"

interface EnrichmentResult {
  company_name: string; domain: string; industry: string; size: string
  revenue: string; location: string; description: string; recent_news: string[]
}

function extractDomain(email: string): string | null {
  const parts = email.split("@")
  return parts.length === 2 ? parts[1] : null
}

export function CrmAiSdr() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<EnrichmentResult | null>(null)
  const [history, setHistory] = useState<Array<{ query: string; result: EnrichmentResult }>>([])
  const [error, setError] = useState("")

  const enrich = async () => {
    if (!query.trim()) return
    setLoading(true)
    setResult(null)
    setError("")

    try {
      const domain = query.includes("@") ? extractDomain(query) : query.toLowerCase().replace(/\s+/g, "")
      if (!domain) { throw new Error("Could not extract domain from input") }

      const res = await fetch("/api/v1/ai/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), domain }),
      })
      if (!res.ok) throw new Error("Enrichment failed")
      const data = await res.json()

      setResult(data)
      setHistory((prev) => [{ query, result: data }, ...prev].slice(0, 10))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrichment failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <p className="text-sm font-medium">AI SDR — Research Assistant</p>
        </div>
        <Badge variant="secondary" className="text-[10px]">Powered by AI</Badge>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Paste a name, email, or company name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enrich()}
          className="flex-1"
        />
        <Button onClick={enrich} disabled={loading || !query.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
          Research
        </Button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <motion.div initial={false} animate={{ height: result ? "auto" : 0 }} className="overflow-hidden">
        {result && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold">{result.company_name}</h3>
                  <p className="text-xs text-muted-foreground">{result.domain}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">{result.industry}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  <Users className="h-4 w-4 text-blue-500" />
                  <div><p className="text-[10px] text-muted-foreground">Size</p><p className="text-xs font-medium">{result.size} employees</p></div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <div><p className="text-[10px] text-muted-foreground">Revenue</p><p className="text-xs font-medium">{result.revenue}</p></div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  <Globe className="h-4 w-4 text-cyan-500" />
                  <div><p className="text-[10px] text-muted-foreground">Location</p><p className="text-xs font-medium">{result.location}</p></div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  <Briefcase className="h-4 w-4 text-amber-500" />
                  <div><p className="text-[10px] text-muted-foreground">Industry</p><p className="text-xs font-medium">{result.industry}</p></div>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Description</p>
                <p className="text-xs">{result.description}</p>
              </div>

              <div>
                <p className="text-xs font-medium mb-2 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />Recent News
                </p>
                <ul className="space-y-1">
                  {result.recent_news.map((news, i) => (
                    <li key={i} className="text-xs flex gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span className="text-muted-foreground">{news}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => fetch("/api/v1/crm/contacts", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: result.company_name, company: result.company_name, source: "ai-sdr" }),
                }).catch(() => {})}>Create Contact</Button>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => fetch("/api/v1/crm/companies", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: result.company_name, domain: result.domain, industry: result.industry, size: result.size }),
                }).catch(() => {})}>Create Account</Button>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => fetch("/api/v1/crm/deals", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: `${result.company_name} - New Deal`, company: result.company_name }),
                }).catch(() => {})}>Add to Deal</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {history.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Recent Searches</p>
          <div className="space-y-1">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30 cursor-pointer text-xs" onClick={() => { setQuery(h.query); setResult(h.result) }}>
                <Building2 className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{h.query}</span>
                <span className="text-muted-foreground">→ {h.result.company_name}</span>
                <Badge variant="secondary" className="text-[10px] ml-auto">{h.result.industry}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
