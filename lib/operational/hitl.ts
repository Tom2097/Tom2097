import { createServiceClient } from "@/lib/supabase/service"

export interface ReviewItem {
  id: string
  organization_id: string
  document_id: string
  action_type: "create_record" | "create_task" | "route" | "send" | "classify"
  proposed_action: Record<string, unknown>
  confidence: number
  status: "pending" | "approved" | "rejected"
  reviewed_by: string | null
  reviewed_at: string | null
  threshold: number
  created_at: string
}

export async function queueForReview(
  organizationId: string,
  documentId: string,
  actionType: ReviewItem["action_type"],
  proposedAction: Record<string, unknown>,
  confidence: number,
  threshold: number = 80,
): Promise<ReviewItem | null> {
  if (confidence >= threshold) return null // Auto-approved

  const db = createServiceClient()
  const { data, error } = await db.from("hitl_reviews").insert({
    organization_id: organizationId, document_id: documentId,
    action_type: actionType, proposed_action: proposedAction,
    confidence, status: "pending", threshold,
  }).select("*").single()
  if (error) return null
  return data as ReviewItem
}

export async function reviewAction(
  reviewId: string,
  approved: boolean,
  userId: string,
): Promise<boolean> {
  const db = createServiceClient()
  const { error } = await db.from("hitl_reviews").update({
    status: approved ? "approved" : "rejected",
    reviewed_by: userId, reviewed_at: new Date().toISOString(),
  }).eq("id", reviewId)
  return !error
}

export async function listPendingReviews(organizationId: string): Promise<ReviewItem[]> {
  const db = createServiceClient()
  const { data } = await db.from("hitl_reviews").select("*, documents(name)").eq("organization_id", organizationId).eq("status", "pending").order("created_at", { ascending: false })
  return (data ?? []) as ReviewItem[]
}
