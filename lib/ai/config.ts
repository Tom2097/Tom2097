/**
 * Module #5: AI Assistant Infrastructure — model configuration.
 *
 * Models are accessed via the Vercel AI Gateway (zero-config for Anthropic).
 * Keeping the default model id in one place so every endpoint stays consistent
 * with the rest of the codebase (chat route + business analyzer use Claude Sonnet).
 */

/** Default conversational model for the assistant. */
export const DEFAULT_CHAT_MODEL = "anthropic/claude-sonnet-4.6"

/** Smaller/faster model for lightweight tasks (suggestions, titles). */
export const FAST_MODEL = "anthropic/claude-sonnet-4.6"

/** Shared base system prompt; tenant context + RAG are appended per request. */
export const BASE_SYSTEM_PROMPT = `You are the DIGIT AI assistant, embedded in a multi-tenant business platform.
You help users understand their organization's data and take action.
Be concise, accurate, and professional. If you are unsure, say so rather than guessing.
Only use information relevant to the user's own organization.`
