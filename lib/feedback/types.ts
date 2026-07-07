/**
 * Module #11: Feedback Management — shared types & enums.
 *
 * Mirrors the public.feedback / feedback_comments / feedback_votes schema.
 * All records are tenant-scoped by organization_id (resolved via withAuth).
 */

export const FEEDBACK_TYPES = ["bug", "feature", "improvement", "question", "general"] as const
export const FEEDBACK_STATUSES = [
  "open",
  "triaged",
  "in_progress",
  "resolved",
  "closed",
  "wont_fix",
] as const
export const FEEDBACK_PRIORITIES = ["low", "normal", "high", "urgent"] as const

export type FeedbackType = (typeof FEEDBACK_TYPES)[number]
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]
export type FeedbackPriority = (typeof FEEDBACK_PRIORITIES)[number]

export interface Feedback {
  id: string
  organization_id: string
  submitted_by: string | null
  assigned_to: string | null
  type: FeedbackType
  status: FeedbackStatus
  priority: FeedbackPriority
  category: string
  title: string
  body: string | null
  rating: number | null
  vote_count: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface FeedbackComment {
  id: string
  organization_id: string
  feedback_id: string
  author_id: string | null
  body: string
  is_internal: boolean
  created_at: string
}

export interface FeedbackInput {
  title: string
  body?: string | null
  type?: FeedbackType
  priority?: FeedbackPriority
  category?: string
  rating?: number | null
  metadata?: Record<string, unknown>
}

export interface FeedbackUpdate {
  status?: FeedbackStatus
  priority?: FeedbackPriority
  assigned_to?: string | null
  type?: FeedbackType
  category?: string
  title?: string
  body?: string | null
  rating?: number | null
  metadata?: Record<string, unknown>
}

export interface ListFeedbackOptions {
  limit?: number
  offset?: number
  status?: FeedbackStatus | null
  type?: FeedbackType | null
  priority?: FeedbackPriority | null
  category?: string | null
  assignedTo?: string | null
  submittedBy?: string | null
  search?: string | null
  sort?: "recent" | "votes"
}
