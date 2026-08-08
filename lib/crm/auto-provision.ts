import { createServiceClient } from "@/lib/supabase/service"
import { sendCommunication, createTask } from "@/lib/crm/extensions"

export const PROVISION_STEP_IDS = ["1", "2", "3", "4", "5", "6"] as const

/**
 * Runs a single auto-provision step for a Won deal's company. Extracted from
 * app/api/v1/ai/provision/route.ts so the same real logic can run either
 * one-at-a-time (the manual "Start" button in the CrmAutoProvision UI, via
 * that route) or all six in sequence with no HTTP round-trips (the
 * automatic path -- see runFullAutoProvision below, invoked by the
 * crm.auto_provision background job when a deal is marked won).
 */
export async function runProvisionStep(
  organizationId: string,
  userId: string,
  dealId: string,
  stepId: string,
): Promise<void> {
  const db = createServiceClient()
  const { data: deal } = await db
    .from("crm_deals")
    .select("id,title,company_id,contact_id,owner_id")
    .eq("id", dealId)
    .eq("organization_id", organizationId)
    .maybeSingle()
  if (!deal) throw new Error("Deal not found")
  if (!deal.company_id) throw new Error("Deal has no associated company to provision")

  switch (stepId) {
    case "1": {
      await db
        .from("customer_accounts")
        .upsert(
          { organization_id: organizationId, company_id: deal.company_id, onboarding_step: "tenant_created", onboarding_completed: false },
          { onConflict: "company_id" },
        )
      break
    }
    case "2": {
      if (deal.contact_id) {
        const { data: contact } = await db.from("crm_contacts").select("email,first_name").eq("id", deal.contact_id).maybeSingle()
        if (contact?.email) {
          await sendCommunication(organizationId, userId, {
            channel: "email",
            direction: "outbound",
            subject: "Welcome aboard!",
            body: `Hi ${contact.first_name || "there"}, welcome! Your account for "${deal.title}" is being set up now.`,
            from_address: "onboarding@digit-ai.in",
            to_address: contact.email,
            contact_id: deal.contact_id,
            deal_id: deal.id,
          })
        }
      }
      break
    }
    case "3": {
      await db.from("customer_accounts").update({ onboarding_step: "account_manager_assigned" }).eq("company_id", deal.company_id).eq("organization_id", organizationId)
      break
    }
    case "4": {
      await createTask(organizationId, userId, {
        entity_type: "deal",
        entity_id: deal.id,
        title: `Kickoff call for ${deal.title}`,
        priority: "high",
        due_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        assigned_to: deal.owner_id ?? undefined,
      })
      break
    }
    case "5": {
      await db.from("customer_accounts").update({ onboarding_step: "implementation_plan_created" }).eq("company_id", deal.company_id).eq("organization_id", organizationId)
      break
    }
    case "6": {
      await db
        .from("crm_integration_status")
        .upsert(
          { organization_id: organizationId, provider: `crm_customer_${deal.company_id}`, status: "active", config: { provisioned_from_deal: deal.id } },
          { onConflict: "organization_id,provider" },
        )
      await db
        .from("customer_accounts")
        .update({ onboarding_completed: true, onboarding_step: "complete" })
        .eq("company_id", deal.company_id)
        .eq("organization_id", organizationId)
      break
    }
    default:
      throw new Error(`Unknown provision step "${stepId}"`)
  }
}

/** Runs all 6 provision steps in order for a deal that just closed Won.
 *  Skips honestly (no-op, not an error) if the deal has no company to
 *  provision -- e.g. a deal that was never linked to a company record. */
export async function runFullAutoProvision(organizationId: string, dealId: string, userId: string): Promise<void> {
  const db = createServiceClient()
  const { data: deal } = await db
    .from("crm_deals")
    .select("company_id")
    .eq("id", dealId)
    .eq("organization_id", organizationId)
    .maybeSingle()
  if (!deal?.company_id) return

  for (const stepId of PROVISION_STEP_IDS) {
    await runProvisionStep(organizationId, userId, dealId, stepId)
  }
}
