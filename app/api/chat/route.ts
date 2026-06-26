import {
  consumeStream,
  convertToCoreMessages,
  streamText,
  UIMessage,
} from 'ai'
import { NextResponse } from 'next/server'
import { extractTenantContext } from '@/lib/multitenant/context'
import { checkTenantRateLimit } from '@/lib/multitenant/rate-limit'
import { mistralModel } from '@/lib/ai/mistral'

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

Be concise, professional, and data-driven in your responses. When discussing metrics or predictions, provide specific numbers when possible. Format responses with clear structure using bullet points or numbered lists when appropriate.

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`

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

  const result = streamText({
    model: mistralModel,
    system: DIGIT_SYSTEM_PROMPT,
    messages: await convertToCoreMessages(messages),
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
