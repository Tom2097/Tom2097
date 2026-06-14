# Module #5: AI Assistant Infrastructure — Implementation Report

## Summary
Backend AI assistant infrastructure for the DIGIT platform: tenant-scoped streaming chat with persisted multi-turn history, RAG retrieval over the Module #4 search index, and suggestion + content-generation endpoints. Built on the AI SDK 6 via the Vercel AI Gateway using Claude Sonnet.

## Scope (confirmed with user)
- Chat + persisted conversation store
- RAG retrieval (reuses Module #4 Upstash Search index)
- Suggest + generate endpoints
- Streaming delivery
- Default model: `anthropic/claude-sonnet-4.6`

## Compatibility (no previous module redesigned)
- **Multi-tenant:** every endpoint derives `organizationId`/`userId` from the verified JWT context (`extractTenantContext` / `withAuth`), never from the request body. RAG and persistence are hard-scoped to the caller's org.
- **Supabase Auth:** identity via the existing JWT validation in Module #1; no new auth surface.
- **Existing schema:** only additive tables (`ai_conversations`, `ai_messages`) with RLS. The pre-existing `/api/chat` route and `lib/ai-business-analyzer.ts` were left untouched.

## Database (additive, RLS-enabled)
- `ai_conversations` — id, organization_id, user_id, title, timestamps.
- `ai_messages` — id, conversation_id, organization_id, role (system/user/assistant), parts (jsonb), created_at.
- RLS: users can only SELECT their own conversations/messages within their org. Writes go through the service-role client with manual org + user scoping (matching the Module #2/#3 pattern).

## Library (`lib/ai/`)
- `config.ts` — default/fast model ids + base system prompt.
- `rag.ts` — `retrieveContext()` runs a tenant-scoped semantic search and formats a context block for prompt injection, with sources for citation.
- `conversation-store.ts` — create/list/load/save conversations + `assertConversationOwnership` for cross-tenant/user protection.

## API (all under `/api/v1/ai`, tenant-scoped)
- `POST /chat` — RAG-augmented streaming chat; creates or continues a conversation, persists the full turn via `onFinish`, returns `x-conversation-id`.
- `GET /conversations` — list the user's conversations.
- `GET /conversations/[conversationId]` — load a conversation's message history (ownership enforced).
- `POST /suggest` — structured next-step suggestions via `Output.object()`.
- `POST /generate` — streaming content generation with optional instructions + RAG context.

## Notes & deviations
- Chat/generate validate tenant context inline with `extractTenantContext` (rather than `withAuth`) because they return SSE `Response` objects; `withAuth` is typed for JSON `NextResponse` and is used for the JSON endpoints (`/conversations`, `/suggest`).
- Persistence uses a clear-and-reinsert strategy per conversation for consistency with the AI SDK `originalMessages` flow.

## Verification
- All Module #5 files pass `tsc --noEmit` with no errors.
