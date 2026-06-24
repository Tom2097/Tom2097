import { createServiceClient } from "@/lib/supabase/service"

export interface OnboardingStep {
  id: string; organization_id: string; name: string; description: string | null
  order: number; assigned_role: string | null; depends_on: string | null
  type: "access" | "training" | "checklist" | "approval"
  config: Record<string, unknown>
}

export interface OnboardingPlan {
  id: string; organization_id: string; user_id: string; status: "pending" | "in_progress" | "completed"
  steps: Array<OnboardingStep & { status: string; completed_at: string | null }>
  created_at: string
}

export async function getOnboardingSteps(organizationId: string): Promise<OnboardingStep[]> {
  const db = createServiceClient()
  const { data } = await db.from("onboarding_steps").select("*").eq("organization_id", organizationId).order("order")
  return (data ?? []) as OnboardingStep[]
}

export async function createOnboardingPlan(organizationId: string, userId: string): Promise<OnboardingPlan | null> {
  const db = createServiceClient()
  const steps = await getOnboardingSteps(organizationId)
  const { data, error } = await db.from("onboarding_plans").insert({
    organization_id: organizationId, user_id: userId, status: "pending",
    steps: steps.map((s) => ({ ...s, status: "pending", completed_at: null })),
  }).select("*").single()
  if (error) return null
  return data as OnboardingPlan
}

export async function completeOnboardingStep(planId: string, stepId: string): Promise<boolean> {
  const db = createServiceClient()
  const { data: plan } = await db.from("onboarding_plans").select("*").eq("id", planId).single()
  if (!plan) return false
  const steps = (plan as any).steps as Array<any>
  const updated = steps.map((s: any) => s.id === stepId ? { ...s, status: "completed", completed_at: new Date().toISOString() } : s)
  const allDone = updated.every((s: any) => s.status === "completed")
  const { error } = await db.from("onboarding_plans").update({
    steps: updated, status: allDone ? "completed" : "in_progress",
  }).eq("id", planId)
  return !error
}
