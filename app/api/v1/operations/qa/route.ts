import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { DEFAULT_CHAT_MODEL, BASE_SYSTEM_PROMPT } from '@/lib/ai/config'
import { extractTenantContext } from '@/lib/multitenant/context.server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  return NextResponse.json({ message: 'Test' })
}

// POST /api/v1/operations/qa -- grounded Q&A over a single document's content,
// backing the Operations Split View's "AI Chat" tab (components/digit/split-view.tsx).
// Answers are generated strictly from the document's own content -- never invented.
export async function POST(request: Request) {
  const ctx = await extractTenantContext()
  if (!ctx?.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { documentId, question } = (await request.json().catch(() => ({}))) as {
    documentId?: string
    question?: string
  }
  if (!documentId || !question?.trim()) {
    return NextResponse.json({ error: 'documentId and question are required' }, { status: 400 })
  }

  try {
    const db = createServiceClient()
    const { data: document, error } = await db
      .from('documents')
      .select('id, name, content')
      .eq('organization_id', ctx.organizationId)
      .eq('id', documentId)
      .maybeSingle()

    if (error) {
      console.error('[v1/operations/qa] fetch failed:', error.message)
      return NextResponse.json({ error: 'Failed to load document' }, { status: 500 })
    }
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const content = (document.content ?? '').toString().trim()
    if (!content) {
      return NextResponse.json({
        data: { answer: "This document doesn't have any extracted content yet, so I can't answer questions about it." },
      })
    }

    const result = await generateText({
      model: DEFAULT_CHAT_MODEL,
      system: `${BASE_SYSTEM_PROMPT}\nYou answer questions strictly using the provided document content. Never invent facts that are not present in the document. If the answer cannot be found in the document, say so plainly rather than guessing.`,
      prompt: `Document: "${document.name}"\n\nContent:\n"""\n${content.slice(0, 15000)}\n"""\n\nQuestion: ${question.trim()}\n\nAnswer concisely, grounded only in the document content above:`,
      temperature: 0.2,
      maxOutputTokens: 800,
    })

    return NextResponse.json({ data: { answer: result.text.trim() } })
  } catch (error) {
    console.error('[v1/operations/qa] error:', error)
    return NextResponse.json({ error: 'Question answering failed' }, { status: 500 })
  }
}
