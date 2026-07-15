import { NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context.server"
import { createServiceClient } from "@/lib/supabase/service"
import { sendCommunication, createTask } from "@/lib/crm/extensions"

function extractDealId(dealUrl: string): string | null {
  const match = dealUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  return match ? match[0] : null
}

// Auto-provision on Won: each of the 6 workflow steps performs a real write for the
// deal's company, scoped to this organization (see the CRM rebuild plan -- full new-tenant
// creation is a separate, much larger platform-admin capability; this provisions the
// workspace-level onboarding artifacts a Won deal actually needs).
export async function POST(request: Request) {
  const ctx = await extractTenantContext()
  if (!ctx?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { stepId, dealUrl } = await request.json().catch(() => ({}))
  if (!stepId || !dealUrl) return NextResponse.json({ error: "stepId and dealUrl are required" }, { status: 400 })

  const dealId = extractDealId(dealUrl)
  if (!dealId) return NextResponse.json({ error: "Could not identify a deal from that URL/ID" }, { status: 400 })

  const db = createServiceClient()
  const { data: deal } = await db
    .from("crm_deals")
    .select("id,title,company_id,contact_id,owner_id")
    .eq("id", dealId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle()
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 })
  if (!deal.company_id) return NextResponse.json({ error: "Deal has no associated company to provision" }, { status: 400 })

  try {
    switch (stepId) {
      case "1": {
        await db
          .from("customer_accounts")
          .upsert(
            { organization_id: ctx.organizationId, company_id: deal.company_id, onboarding_step: "tenant_created", onboarding_completed: false },
            { onConflict: "company_id" },
          )
        break
      }
      case "2": {
        if (deal.contact_id) {
          const { data: contact } = await db.from("crm_contacts").select("email,first_name").eq("id", deal.contact_id).maybeSingle()
          if (contact?.email) {
            await sendCommunication(ctx.organizationId, ctx.userId, {
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
        await db.from("customer_accounts").update({ onboarding_step: "account_manager_assigned" }).eq("company_id", deal.company_id).eq("organization_id", ctx.organizationId)
        break
      }
      case "4": {
        await createTask(ctx.organizationId, ctx.userId, {
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
        await db.from("customer_accounts").update({ onboarding_step: "implementation_plan_created" }).eq("company_id", deal.company_id).eq("organization_id", ctx.organizationId)
        break
      }
      case "6": {
        await db
          .from("crm_integration_status")
          .upsert(
            { organization_id: ctx.organizationId, provider: `crm_customer_${deal.company_id}`, status: "active", config: { provisioned_from_deal: deal.id } },
            { onConflict: "organization_id,provider" },
          )
        await db
          .from("customer_accounts")
          .update({ onboarding_completed: true, onboarding_step: "complete" })
          .eq("company_id", deal.company_id)
          .eq("organization_id", ctx.organizationId)
        break
      }
      default:
        return NextResponse.json({ error: "Unknown step" }, { status: 400 })
    }
    return NextResponse.json({ success: true, stepId })
  } catch (error) {
    console.error("[ai/provision] step failed:", error)
    return NextResponse.json({ error: "Provisioning step failed" }, { status: 500 })
  }
}
