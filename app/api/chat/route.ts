import {
  consumeStream,
  convertToModelMessages,
  streamText,
  UIMessage,
} from 'ai'
import { NextResponse } from 'next/server'
import { extractTenantContext } from '@/lib/multitenant/context.server'
import { checkTenantRateLimit } from '@/lib/multitenant/rate-limit'
import { mistralModel } from '@/lib/ai/mistral'
import { retrieveContext } from '@/lib/ai/rag'

export const maxDuration = 30

const DIGIT_SYSTEM_PROMPT = `You are DigiT AI, an intelligent enterprise assistant for the DigiT Operational Intelligence Platform. You help enterprise users with:

1. **Analytics & Insights**: Analyze business data, explain trends, and provide actionable insights from revenue forecasting, risk analysis, and operational metrics.

2. **Module Guidance**: Help users navigate and utilize the platform's AI modules:
   - AI Analytics: Revenue forecasting, risk analysis, predictive modeling
   - Smart CRM: Customer intelligence, lead tracking, sales automation
   - Operations Workspace: Process monitoring, resource planning, workflow optimization
   - Performance Workspace: Anomaly detection, scoring, signal tracking, risk assessment
   - Resource Workspace: Demand forecasting, capacity analysis, inventory intelligence
   - Compliance Workspace: Audit tracking, quality control, process management

3. **Predictions & Recommendations**: Provide AI-powered predictions and strategic recommendations based on enterprise data patterns.

4. **Technical Support**: Assist with platform features, data integration, and workflow automation.

Be concise, professional, and data-driven in your responses. When discussing metrics or predictions (e.g. revenue forecasts), only state specific numbers that actually appear in the "Relevant context from this organization's data" block provided below the conversation, if any. Never invent or estimate a figure that isn't backed by that context -- if the context doesn't cover what's being asked, say plainly that you don't have real data for it instead of guessing a number. Format responses with clear structure using bullet points or numbered lists when appropriate.

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`

/** Pull the plain text out of a UIMessage's parts (text parts only). */
function messageText(message: UIMessage): string {
  return (message.parts ?? [])
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim()
}

export async function POST(req: Request) {
  // Require an authenticated session — the AI Assistant uses the same identity
  // model as every other module. Unauthenticated callers cannot reach the LLM.
  const context = await extractTenantContext()
  if (!context) {
    return NextResponse.json(
      { error: "Unauthorized", message: "You must be signed in to use the assistant" },
      { status: 401 },
    )
  }

  // Abuse protection: meter the LLM proxy per tenant. The assistant is far more
  // expensive than a normal API call, so cap it tighter than the default.
  const rateLimited = await checkTenantRateLimit(context.tenantId, 200, 20)
  if (rateLimited) return rateLimited

  const { messages }: { messages: UIMessage[] } = await req.json()

  // Ground the assistant in this org's real data (Module #5 RAG) so it can
  // cite actual figures instead of inventing them. Retrieval is keyed off the
  // latest user message and always scoped to the caller's own organization.
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
  const { contextBlock } = lastUserMessage
    ? await retrieveContext(context.organizationId, messageText(lastUserMessage))
    : { contextBlock: '' }

  const system = contextBlock ? `${DIGIT_SYSTEM_PROMPT}\n\n${contextBlock}` : DIGIT_SYSTEM_PROMPT

  const result = streamText({
    model: mistralModel,
    system,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
