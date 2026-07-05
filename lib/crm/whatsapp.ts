import { createServiceClient } from "@/lib/supabase/service"
import { sendWhatsAppMessage, sendWhatsAppTemplate, type WhatsAppMessage } from "@/lib/operational/whatsapp"
import { addTimelineEntry, createTask } from "./extensions"

export interface CrmWhatsAppConfig {
  organizationId: string
  webhookVerified: boolean
  autoCreateContact: boolean
  autoCreateLead: boolean
  nurtureEnabled: boolean
  defaultAssignee: string | null
}

export async function getCrmWhatsAppConfig(
  organizationId: string,
): Promise<CrmWhatsAppConfig> {
  const db = createServiceClient()
  const { data } = await db
    .from("organization_settings")
    .select("whatsapp_config")
    .eq("id", organizationId)
    .maybeSingle()

    const config = (data as { whatsapp_config?: { webhookVerified?: unknown; autoCreateContact?: unknown; autoCreateLead?: unknown; nurtureEnabled?: unknown; defaultAssignee?: unknown } })?.whatsapp_config || {}
  return {
    organizationId,
    webhookVerified: config.webhookVerified === true,
    autoCreateContact: config.autoCreateContact !== false,
    autoCreateLead: config.autoCreateLead !== false,
    nurtureEnabled: config.nurtureEnabled !== false,
    defaultAssignee: typeof config.defaultAssignee === 'string' ? config.defaultAssignee : null,
  }
}

export async function handleIncomingCrmWhatsApp(
  organizationId: string,
  msg: WhatsAppMessage,
  config: CrmWhatsAppConfig,
): Promise<string | null> {
  const db = createServiceClient()

  const { data: existingContact } = await db
    .from("crm_contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .or(`phone.eq.${msg.from},email.eq.${msg.from}@inbound.whatsapp`)
    .maybeSingle()

  let contactId = existingContact?.id as string | undefined

  if (!contactId && config.autoCreateContact) {
    const { data: contact } = await db.from("crm_contacts").insert({
      organization_id: organizationId,
      first_name: `WA-${msg.from.slice(-4)}`,
      phone: msg.from,
      email: `${msg.from}@inbound.whatsapp`,
      status: config.autoCreateLead ? "lead" : "active",
      source: "whatsapp",
    }).select("id").single()

    if (contact) {
      contactId = contact.id as string
      await addTimelineEntry(organizationId, "system", {
        entity_type: "contact",
        entity_id: contactId,
        entry_type: "note",
        title: "Contact created via WhatsApp",
        description: `Auto-created from incoming WhatsApp message: ${msg.body.slice(0, 200)}`,
        metadata: { source: "whatsapp", whatsapp_message_id: msg.id },
      })
    }
  }

  if (contactId) {
    await addTimelineEntry(organizationId, "system", {
      entity_type: "contact",
      entity_id: contactId,
      entry_type: "whatsapp",
      title: `WhatsApp message received`,
      description: msg.body.slice(0, 500),
      metadata: {
        source: "whatsapp",
        whatsapp_message_id: msg.id,
        message_type: msg.type,
        has_media: !!msg.mediaUrl,
      },
    })
  }

  if (config.nurtureEnabled && msg.body.toLowerCase().includes("interested")) {
    await createTask(organizationId, "system", {
      entity_type: "contact",
      entity_id: contactId,
      title: `Follow up with WhatsApp lead ${msg.from}`,
      description: `Lead expressed interest via WhatsApp: "${msg.body.slice(0, 200)}"`,
      priority: "high",
      assigned_to: config.defaultAssignee,
    })
  }

  return contactId || null
}

export async function sendCrmWhatsApp(
  organizationId: string,
  userId: string,
  to: string,
  body: string,
  contactId?: string,
  dealId?: string,
): Promise<boolean> {
  const sent = await sendWhatsAppMessage(to, body)
  if (!sent) return false

  await addTimelineEntry(organizationId, userId, {
    entity_type: contactId ? "contact" : "deal",
    entity_id: (contactId || dealId)!,
    entry_type: "whatsapp",
    title: "WhatsApp message sent",
    description: body.slice(0, 500),
    metadata: { source: "whatsapp", channel: "outbound" },
  })

  return true
}

export async function getWhatsAppMessageHistory(
  organizationId: string,
  contactId: string,
): Promise<Array<{ role: "sent" | "received"; body: string; timestamp: string }>> {
  const db = createServiceClient()
  const { data } = await db
    .from("crm_timeline")
    .select("title, description, metadata, occurred_at")
    .eq("organization_id", organizationId)
    .eq("entity_type", "contact")
    .eq("entity_id", contactId)
    .eq("entry_type", "whatsapp")
    .order("occurred_at", { ascending: false })
    .limit(50)

  return ((data ?? []) as Array<{
    title: string; description: string; metadata: Record<string, unknown>; occurred_at: string
  }>).map((e) => ({
    role: (e.metadata?.channel === "outbound" ? "sent" : "received") as "sent" | "received",
    body: e.description,
    timestamp: e.occurred_at,
  }))
}
