import { NextResponse } from "next/server"
import { generateText } from "ai"
import { DEFAULT_CHAT_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"
import { extractTenantContext } from "@/lib/multitenant/context"
import { createServiceClient } from "@/lib/supabase/service"

export async function POST(request: Request) {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 403 })

    const { documentId, question } = await request.json()
    if (!documentId || !question) return NextResponse.json({ error: "documentId and question are required" }, { status: 400 })

    const db = createServiceClient()
    const { data: doc } = await db.from("documents")
      .select("name, content, extracted_entities, classification, metadata")
      .eq("id", documentId)
      .eq("organization_id", orgId)
      .single()

    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 })

    const systemPrompt = `${BASE_SYSTEM_PROMPT}
You are a RAG (Retrieval-Augmented Generation) assistant. Answer the user's question based ONLY on the provided document content.
If the answer cannot be found in the document, say so clearly.
Be concise and cite specific parts of the document when possible.`

    const contextParts: string[] = [`Document: ${doc.name}`, `Content: ${doc.content ?? "(empty)"}`]
    if (doc.extracted_entities) {
      contextParts.push(`Extracted Data: ${JSON.stringify(doc.extracted_entities, null, 2)}`)
    }
    if (doc.classification) {
      contextParts.push(`Classification: ${doc.classification}`)
    }

    const result = await generateText({
      model: DEFAULT_CHAT_MODEL,
      system: systemPrompt,
      prompt: `Document Context:\n"""\n${contextParts.join("\n\n")}\n"""\n\nQuestion: ${question}\n\nAnswer based on the document:`,
      temperature: 0.2,
      maxOutputTokens: 1000,
    })

    return NextResponse.json({
      success: true,
      data: {
        answer: result.text.trim(),
        document_name: doc.name,
        document_id: documentId,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "QA failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
