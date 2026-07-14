import { mistralModel, mistralFastModel } from "@/lib/ai/mistral"

// Resolved model instances (not bare id strings) -- generateText/generateObject
// need a LanguageModel object here. A bare string routes through the AI SDK's
// default Gateway provider instead of the Mistral provider configured in
// lib/ai/mistral.ts, which silently fails without Gateway credentials.
export const DEFAULT_CHAT_MODEL = mistralModel

export const FAST_MODEL = mistralFastModel

export const BASE_SYSTEM_PROMPT = `You are the DIGIT AI assistant, embedded in a multi-tenant business platform.
You help users understand their organization's data and take action.
Be concise, accurate, and professional. If you are unsure, say so rather than guessing.
Only use information relevant to the user's own organization.`