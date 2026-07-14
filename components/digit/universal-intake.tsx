"use client"

import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, Mail, Mic, Camera, Link, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react"

export function UniversalIntake() {
  const [activeDoor, setActiveDoor] = useState("upload")
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    docId?: string
    error?: string
    analysis?: { documentType?: string; summary?: string; keyFields?: Record<string, string>; status?: string }
  } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const doors = [
    { id: "upload", label: "Upload", icon: Upload, color: "text-blue-500" },
    { id: "email", label: "Email", icon: Mail, color: "text-purple-500" },
    { id: "voice", label: "Voice", icon: Mic, color: "text-pink-500" },
    { id: "scan", label: "Scan", icon: Camera, color: "text-emerald-500" },
    { id: "url", label: "URL", icon: Link, color: "text-cyan-500" },
  ]

  const handleUrlIngest = async () => {
    if (!url.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/v1/operations/ingest-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      setResult({ success: res.ok, docId: data.document_id, error: data.error, analysis: data.analysis })
    } catch { setResult({ success: false, error: "Network error" }) }
    finally { setLoading(false) }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/operations/upload", { method: "POST", body: formData })
      const data = await res.json()
      setResult({ success: res.ok, docId: data.document?.id, error: data.error, analysis: data.document?.analysis })
    } catch { setResult({ success: false, error: "Upload failed" }) }
    finally { setLoading(false) }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-1 mb-6">
          {doors.map((door) => (
            <Button key={door.id} variant={activeDoor === door.id ? "default" : "ghost"} size="sm" onClick={() => { setActiveDoor(door.id); setResult(null) }}>
              <door.icon className={`h-4 w-4 mr-1.5 ${activeDoor === door.id ? "" : door.color}`} />
              {door.label}
            </Button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={activeDoor} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {activeDoor === "upload" && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">Drop files here or click to browse</p>
                <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} />
                <Button onClick={() => fileRef.current?.click()} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  {loading ? "Uploading..." : "Select File"}
                </Button>
              </div>
            )}

            {activeDoor === "email" && (
              <div className="py-8 text-center space-y-3">
                <Mail className="h-10 w-10 mx-auto text-purple-500" />
                <p className="text-sm font-medium">Forward emails to</p>
                <code className="px-3 py-1.5 bg-muted rounded-lg text-sm font-mono">ingest@digit.app</code>
                <p className="text-xs text-muted-foreground">Attachments are automatically extracted and processed</p>
              </div>
            )}

            {activeDoor === "voice" && (
              <div className="py-8 text-center space-y-3">
                <Mic className="h-10 w-10 mx-auto text-pink-500" />
                <p className="text-sm font-medium">Send voice notes via WhatsApp</p>
                <code className="px-3 py-1.5 bg-muted rounded-lg text-sm font-mono">+1 (555) DIGIT-01</code>
                <p className="text-xs text-muted-foreground">Voice notes are transcribed and processed automatically</p>
              </div>
            )}

            {activeDoor === "scan" && (
              <div className="py-8 text-center space-y-3">
                <Camera className="h-10 w-10 mx-auto text-emerald-500" />
                <p className="text-sm font-medium">Snap a photo to upload</p>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
                <Button variant="outline" onClick={() => fileRef.current?.click()}><Camera className="h-4 w-4 mr-2" />Take Photo</Button>
                <p className="text-xs text-muted-foreground">OCR extracts text from scans of invoices, whiteboards, handwritten notes</p>
              </div>
            )}

            {activeDoor === "url" && (
              <div className="py-8 space-y-4">
                <div className="flex gap-2">
                  <Input placeholder="Paste a URL..." value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleUrlIngest()} />
                  <Button onClick={handleUrlIngest} disabled={loading || !url.trim()}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
                  </Button>
                </div>
              </div>
            )}

            {result && (
              <div className={`rounded-lg mt-4 p-3 ${result.success ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
                <div className="flex items-center gap-2">
                  {result.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  <span className="text-sm">
                    {result.success
                      ? result.analysis?.documentType
                        ? `Classified as ${result.analysis.documentType}`
                        : `Ingested: ${result.docId}`
                      : result.error}
                  </span>
                </div>
                {result.analysis?.summary && (
                  <p className="mt-2 text-sm text-foreground/80">{result.analysis.summary}</p>
                )}
                {result.analysis?.keyFields && Object.keys(result.analysis.keyFields).length > 0 && (
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {Object.entries(result.analysis.keyFields).map(([key, value]) => (
                      <div key={key} className="contents">
                        <dt className="text-muted-foreground">{key}</dt>
                        <dd className="text-foreground/90 truncate">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {result.analysis?.status === "failed" && (
                  <p className="mt-2 text-xs text-muted-foreground">Saved, but analysis couldn&apos;t be completed.</p>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
