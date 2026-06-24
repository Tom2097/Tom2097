import { createServiceClient } from "@/lib/supabase/service"

export interface OcrResult {
  text: string
  confidence: number
  blocks: Array<{ text: string; confidence: number; bbox: { x: number; y: number; w: number; h: number } }>
  language: string
}

export async function runOcr(documentId: string, organizationId: string): Promise<OcrResult | null> {
  const db = createServiceClient()

  const { data: doc } = await db
    .from("documents")
    .select("storage_path, mime_type")
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!doc || !doc.storage_path) return null

  const { data: signed } = await db.storage
    .from("documents")
    .createSignedUrl(doc.storage_path as string, 300)

  if (!signed) return null

  try {
    const res = await fetch(signed.signedUrl)
    const buffer = await res.arrayBuffer()

    const formData = new FormData()
    formData.append("image", new Blob([buffer], { type: (doc.mime_type as string) || "image/png" }))

    const apiKey = process.env.OCR_API_KEY
    if (apiKey) {
      const ocrRes = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        headers: { apikey: apiKey },
        body: formData,
      })
      const ocrData = await ocrRes.json()
      if (ocrData?.ParsedResults?.[0]) {
        const parsed = ocrData.ParsedResults[0]
        const result: OcrResult = {
          text: parsed.ParsedText || "",
          confidence: parsed.FileParseExitCode === 1 ? 90 : 50,
          blocks: [],
          language: "en",
        }
        await db.from("documents").update({
          content: result.text,
          metadata: { ...doc, ocr_confidence: result.confidence, ocr_processed_at: new Date().toISOString() },
        }).eq("id", documentId)
        return result
      }
    }

    // Fallback: no OCR available
    return null
  } catch (err) {
    console.log("[v0] OCR failed:", err)
    return null
  }
}
