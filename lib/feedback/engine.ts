import { createServiceClient } from "@/lib/supabase/service"
import {
  FEEDBACK_PRIORITIES,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  type Feedback,
  type FeedbackComment,
  type FeedbackInput,
  type FeedbackUpdate,
  type ListFeedbackOptions,
} from "./types"

/**
 * Module #11: Feedback engine.
 *
 * Writes go through the service client (RLS-exempt) but EVERY function takes an
 * already-validated `organizationId` (resolved by withAuth) and scopes all I/O
 * to it, preserving the multi-tenant boundary. Cross-tenant ids therefore
 * no-op rather than leaking data.
 */

function pick<T extends readonly string[]>(allowed: T, v: unknown, fallback: T[number]): T[number] {
  return allowed.includes(v as T[number]) ? (v as T[number]) : fallback
}

/** Validate a feedback submission payload. Returns an error string or null. */
export function validateFeedback(input: unknown): string | null {
  if (!input || typeof input !== "object") return "feedback must be an object"
  const f = input as FeedbackInput
  if (!f.title || typeof f.title !== "string" || !f.title.trim()) return "title is required"
  if (f.title.length > 300) return "title too long (max 300)"
  if (f.body != null && typeof f.body !== "string") return "body must be a string"
  if (f.rating != null && (typeof f.rating !== "number" || f.rating < 1 || f.rating > 5)) {
    return "rating must be an integer between 1 and 5"
  }
  if (f.metadata != null && typeof f.metadata !== "object") return "metadata must be an object"
  return null
}

/** Create feedback. submittedBy is the authenticated caller. */
export async function submitFeedback(
  organizationId: string,
  submittedBy: string,
  input: FeedbackInput,
): Promise<Feedback> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("feedback")
    .insert({
      organization_id: organizationId,
      submitted_by: submittedBy,
      title: input.title.trim(),
      body: input.body?.trim() || null,
      type: pick(FEEDBACK_TYPES, input.type, "general"),
      priority: pick(FEEDBACK_PRIORITIES, input.priority, "normal"),
      category: (input.category ?? "general").trim() || "general",
      rating: input.rating ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single()
  if (error) {
    console.log("[v0] submitFeedback failed:", error.message)
    throw new Error("failed to submit feedback")
  }
  return data as Feedback
}

/** List feedback for an org with filters, search, sort and pagination. */
export async function listFeedback(
  organizationId: string,
  opts: ListFeedbackOptions,
): Promise<{ feedback: Feedback[]; total: number }> {
  const db = createServiceClient()
  let query = db
    .from("feedback")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)

  if (opts.status) query = query.eq("status", opts.status)
  if (opts.type) query = query.eq("type", opts.type)
  if (opts.priority) query = query.eq("priority", opts.priority)
  if (opts.category) query = query.eq("category", opts.category)
  if (opts.assignedTo) query = query.eq("assigned_to", opts.assignedTo)
  if (opts.submittedBy) query = query.eq("submitted_by", opts.submittedBy)
  if (opts.search && opts.search.trim()) {
    const term = opts.search.trim().replace(/[%,]/g, " ")
    query = query.or(`title.ilike.%${term}%,body.ilike.%${term}%`)
  }

  if (opts.sort === "votes") {
    query = query.order("vote_count", { ascending: false }).order("created_at", { ascending: false })
  } else {
    query = query.order("created_at", { ascending: false })
  }

  query = query.range(opts.offset, opts.offset + opts.limit - 1)

  const { data, error, count } = await query
  if (error) {
    console.log("[v0] listFeedback failed:", error.message)
    throw new Error("failed to list feedback")
  }
  return { feedback: (data ?? []) as Feedback[], total: count ?? 0 }
}

/** Fetch a single feedback row, scoped to org. Returns null if not found. */
export async function getFeedback(
  organizationId: string,
  feedbackId: string,
): Promise<Feedback | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("feedback")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", feedbackId)
    .maybeSingle()
  if (error) {
    console.log("[v0] getFeedback failed:", error.message)
    throw new Error("failed to fetch feedback")
  }
  return (data as Feedback) ?? null
}

/** Update mutable fields (status/priority/assignee/type/category/title/body). Scoped to org. */
export async function updateFeedback(
  organizationId: string,
  feedbackId: string,
  patch: FeedbackUpdate,
): Promise<Feedback | null> {
  const update: Record<string, unknown> = {}
  if (patch.status !== undefined) update.status = pick(FEEDBACK_STATUSES, patch.status, "open")
  if (patch.priority !== undefined) update.priority = pick(FEEDBACK_PRIORITIES, patch.priority, "normal")
  if (patch.type !== undefined) update.type = pick(FEEDBACK_TYPES, patch.type, "general")
  if (patch.assigned_to !== undefined) update.assigned_to = patch.assigned_to
  if (patch.category !== undefined) update.category = (patch.category ?? "general").trim() || "general"
  if (patch.title !== undefined && patch.title.trim()) update.title = patch.title.trim()
  if (patch.body !== undefined) update.body = patch.body?.trim() || null

  if (Object.keys(update).length === 0) return getFeedback(organizationId, feedbackId)

  const db = createServiceClient()
  const { data, error } = await db
    .from("feedback")
    .update(update)
    .eq("organization_id", organizationId)
    .eq("id", feedbackId)
    .select("*")
    .maybeSingle()
  if (error) {
    console.log("[v0] updateFeedback failed:", error.message)
    throw new Error("failed to update feedback")
  }
  return (data as Feedback) ?? null
}

/** Delete feedback (and cascade comments/votes). Scoped to org. */
export async function deleteFeedback(
  organizationId: string,
  feedbackId: string,
): Promise<boolean> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("feedback")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", feedbackId)
    .select("id")
  if (error) {
    console.log("[v0] deleteFeedback failed:", error.message)
    throw new Error("failed to delete feedback")
  }
  return (data ?? []).length > 0
}

/** List comments for a feedback item. Non-admins should not see internal notes. */
export async function listComments(
  organizationId: string,
  feedbackId: string,
  includeInternal: boolean,
): Promise<FeedbackComment[]> {
  const db = createServiceClient()
  let query = db
    .from("feedback_comments")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("feedback_id", feedbackId)
    .order("created_at", { ascending: true })
  if (!includeInternal) query = query.eq("is_internal", false)

  const { data, error } = await query
  if (error) {
    console.log("[v0] listComments failed:", error.message)
    throw new Error("failed to list comments")
  }
  return (data ?? []) as FeedbackComment[]
}

/** Add a comment. internal notes require manage permission (enforced in route). */
export async function addComment(
  organizationId: string,
  feedbackId: string,
  authorId: string,
  body: string,
  isInternal: boolean,
): Promise<FeedbackComment> {
  // Verify the feedback belongs to this org before commenting.
  const parent = await getFeedback(organizationId, feedbackId)
  if (!parent) throw new Error("feedback not found")

  const db = createServiceClient()
  const { data, error } = await db
    .from("feedback_comments")
    .insert({
      organization_id: organizationId,
      feedback_id: feedbackId,
      author_id: authorId,
      body: body.trim(),
      is_internal: isInternal,
    })
    .select("*")
    .single()
  if (error) {
    console.log("[v0] addComment failed:", error.message)
    throw new Error("failed to add comment")
  }
  return data as FeedbackComment
}

/**
 * Toggle a user's vote on a feedback item. Returns the resulting state.
 * The vote_count column is maintained by a DB trigger.
 */
export async function voteFeedback(
  organizationId: string,
  feedbackId: string,
  userId: string,
): Promise<{ voted: boolean; voteCount: number }> {
  const parent = await getFeedback(organizationId, feedbackId)
  if (!parent) throw new Error("feedback not found")

  const db = createServiceClient()
  const { data: existing, error: selErr } = await db
    .from("feedback_votes")
    .select("user_id")
    .eq("feedback_id", feedbackId)
    .eq("user_id", userId)
    .maybeSingle()
  if (selErr) {
    console.log("[v0] toggleVote select failed:", selErr.message)
    throw new Error("failed to read vote")
  }

  let voted: boolean
  if (existing) {
    const { error } = await db
      .from("feedback_votes")
      .delete()
      .eq("feedback_id", feedbackId)
      .eq("user_id", userId)
    if (error) {
      console.log("[v0] toggleVote delete failed:", error.message)
      throw new Error("failed to remove vote")
    }
    voted = false
  } else {
    const { error } = await db.from("feedback_votes").insert({
      feedback_id: feedbackId,
      organization_id: organizationId,
      user_id: userId,
    })
    if (error) {
      console.log("[v0] toggleVote insert failed:", error.message)
      throw new Error("failed to add vote")
    }
    voted = true
  }

  const updated = await getFeedback(organizationId, feedbackId)
  return { voted, voteCount: updated?.vote_count ?? 0 }
}
