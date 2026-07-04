import { withAuth } from "@/lib/auth/with-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"
import { NextResponse } from "next/server"

const provisionSteps = [
  { id: "company", label: "Create company record" },
  { id: "workspace", label: "Provision operations workspace" },
  { id: "users", label: "Create admin user accounts" },
  { id: "integrations", label: "Configure default integrations" },
  { id: "onboarding", label: "Send onboarding guide" },
  { id: "activate", label: "Activate subscription" },
]

export const GET = withAuth(async () => {
  return NextResponse.json({ steps: provisionSteps })
})

export const POST = withAuth(async (req, { organizationId, userId }) => {
  const { stepId, dealUrl } = await req.json()

  if (!stepId) return NextResponse.json({ error: "stepId required" }, { status: 400 })
  const step = provisionSteps.find(s => s.id === stepId)
  if (!step) return NextResponse.json({ error: "Invalid step" }, { status: 400 })

  const supabase = createServiceClient()

  switch (stepId) {
    case "company": {
      await supabase.from("organizations").update({ name: `Customer - ${dealUrl || "New"}` }).eq("id", organizationId)
      break
    }
    case "workspace": {
      await supabase.from("workspaces").insert({ organization_id: organizationId, name: "Operations", type: "operations", config: {} })
      break
    }
    case "users": {
      const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", userId).single()
      if (profile) {
        await supabase.from("invitations").insert({ organization_id: organizationId, email: profile.email, role: "admin", invited_by: userId, status: "accepted" })
      }
      break
    }
    case "integrations": {
      await supabase.from("connectors").insert({ organization_id: organizationId, name: "Default Email", type: "gmail", enabled: true, credentials: {}, settings: {} })
      break
    }
    case "onboarding": {
      await supabase.from("notifications").insert({ organization_id: organizationId, user_id: userId, type: "info", category: "onboarding", title: "Welcome to DigiT!", body: "Your workspace is ready. Check the onboarding guide to get started." })
      break
    }
    case "activate": {
      await supabase.from("subscriptions").update({ status: "active" }).eq("organization_id", organizationId)
      break
    }
  }

  await logAuthEvent({
    action: "crm.auto_provision",
    userId,
    organizationId: organizationId ?? undefined,
    metadata: { stepId, dealUrl },
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({ success: true, step: { id: stepId, label: step.label, completed: true } })
})
