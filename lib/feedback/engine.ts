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
      title: input.title,
      body: input.body,
      type: pick(FEEDBACK_TYPES, input.type, "general"),
      category: input.category || "general",
      priority: pick(FEEDBACK_PRIORITIES, input.priority, "medium"),
      status: "new",
      rating: input.rating,
      submitted_by: submittedBy,
      metadata: input.metadata,
    })
    .select("*")
    .single()
  if (error) throw error
  return data
}

/** List feedback with optional filters. */
export async function listFeedback(
  organizationId: string,
  options: ListFeedbackOptions = {},
): Promise<Feedback[]> {
  const { search, status, type, sort, limit = 100 } = options
  let query = new URLSearchParams()
  if (search) query.set("search", search)
  if (status) query.set("status", status)
  if (type) query.set("type", type)
  if (sort) query.set("sort", sort)
  query.set("limit", String(limit))

  const db = createServiceClient()
  let q = db
    .from("feedback")
    .select("*, comments:feedback_comments(*), votes:feedback_votes(*)", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })

  if (search) {
    q = q.or(`title.ilike.%${search}%,body.ilike.%${search}%`)
  }
  if (status) {
    q = q.eq("status", status)
  }
  if (type) {
    q = q.eq("type", type)
  }
  if (sort === "votes") {
    q = q.order("vote_count", { ascending: false })
  }

  const { data, error } = await q.limit(limit)
  if (error) throw error
  return data
}

/** Get a single feedback item by id. */
export async function getFeedback(
  organizationId: string,
  feedbackId: string,
): Promise<Feedback | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("feedback")
    .select("*, comments:feedback_comments(*), votes:feedback_votes(*)")
    .eq("organization_id", organizationId)
    .eq("id", feedbackId)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Update feedback. */
export async function updateFeedback(
  organizationId: string,
  feedbackId: string,
  update: FeedbackUpdate,
): Promise<Feedback> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("feedback")
    .update({
      title: update.title,
      body: update.body,
      type: update.type ? pick(FEEDBACK_TYPES, update.type, "general") : undefined,
      category: update.category,
      priority: update.priority ? pick(FEEDBACK_PRIORITIES, update.priority, "medium") : undefined,
      status: update.status ? pick(FEEDBACK_STATUSES, update.status, "new") : undefined,
      rating: update.rating,
      metadata: update.metadata,
    })
    .eq("organization_id", organizationId)
    .eq("id", feedbackId)
    .select("*")
    .single()
  if (error) throw error
  return data
}

/** Create a comment on feedback. */
export async function createComment(
  organizationId: string,
  feedbackId: string,
  submittedBy: string,
  text: string,
): Promise<FeedbackComment> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("feedback_comments")
    .insert({
      organization_id: organizationId,
      feedback_id: feedbackId,
      submitted_by: submittedBy,
      text,
    })
    .select("*")
    .single()
  if (error) throw error
  return data
}

/** Get feedback statistics for dashboard. */
export async function getFeedbackStats(organizationId: string) {
  const db = createServiceClient()
  
  // Get sentiment score (average sentiment)
  const { data: sentimentData, error: sentimentError } = await db
    .from("feedback")
    .select("sentiment_score")
    .eq("organization_id", organizationId)
    .not("sentiment_score", "is", null)
    
  // Get response metrics
  const { count: totalItems, error: countError } = await db
    .from("feedback")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    
  // Get open items count
  const { count: openItems, error: openError } = await db
    .from("feedback")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("status", ["new", "in_progress"])
    
  if (sentimentError || countError || openError) {
    console.log("[v0] getFeedbackStats failed:", sentimentError?.message, countError?.message, openError?.message)
    return {
      sentimentScore: 0,
      responseTime: 0,
      categorizationAccuracy: 0,
      responseRate: 0,
      openItems: 0,
      totalItems: 0
    }
  }
  
  // Calculate metrics
  const sentimentScore = sentimentData && sentimentData.length > 0
    ? Math.round(sentimentData.reduce((sum, item) => sum + (item.sentiment_score || 0), 0) / sentimentData.length)
    : 0
  
  const responseRate = totalItems > 0 ? Math.round(((totalItems - (openItems || 0)) / totalItems) * 100) : 0
  
  // Default values for metrics not available in current schema
  const responseTime = 0
  const categorizationAccuracy = 0
  
  return {
    sentimentScore,
    responseTime,
    categorizationAccuracy,
    responseRate,
    openItems: openItems || 0,
    totalItems
  }
}

/** Vote for feedback. */
export async function voteFeedback(
  organizationId: string,
  feedbackId: string,
  userId: string,
): Promise<{ voted: boolean; voteCount: number }> {
  const db = createServiceClient()
  let voted = false

  // Check if already voted
  const { data: existing, error: checkError } = await db
    .from("feedback_votes")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("feedback_id", feedbackId)
    .eq("user_id", userId)
    .maybeSingle()

  if (checkError) {
    console.log("[v0] voteFeedback check failed:", checkError.message)
    throw new Error("failed to check vote status")
  }

  if (existing) {
    // Remove vote
    const { error } = await db
      .from("feedback_votes")
      .delete()
      .eq("organization_id", organizationId)
      .eq("feedback_id", feedbackId)
      .eq("user_id", userId)
    if (error) {
      console.log("[v0] voteFeedback delete failed:", error.message)
      throw new Error("failed to remove vote")
    }
    voted = false
  } else {
    // Add vote
    const { error } = await db
      .from("feedback_votes")
      .insert({
        organization_id: organizationId,
        feedback_id: feedbackId,
        user_id: userId,
      })
      if (error) {
        console.log("[v0] voteFeedback insert failed:", error.message)
        throw new Error("failed to add vote")
      }
      voted = true
  }

  const updated = await getFeedback(organizationId, feedbackId)
  return { voted, voteCount: updated?.vote_count ?? 0 }
}