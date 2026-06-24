import { createServiceClient } from "@/lib/supabase/service"
import type { ConnectorConfig, ConnectorInput, SyncResult } from "./types"

export async function listConnectors(organizationId: string): Promise<ConnectorConfig[]> {
  const db = createServiceClient()
  const { data } = await db
    .from("connectors")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
  return (data ?? []) as ConnectorConfig[]
}

export async function createConnector(
  organizationId: string,
  userId: string,
  input: ConnectorInput,
): Promise<ConnectorConfig | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("connectors")
    .insert({
      organization_id: organizationId,
      name: input.name,
      type: input.type,
      credentials: input.credentials,
      settings: input.settings ?? {},
      enabled: true,
      created_by: userId,
    })
    .select("*")
    .single()
  if (error) return null
  return data as ConnectorConfig
}

export async function deleteConnector(organizationId: string, connectorId: string): Promise<boolean> {
  const db = createServiceClient()
  const { error } = await db
    .from("connectors")
    .delete()
    .eq("id", connectorId)
    .eq("organization_id", organizationId)
  return !error
}

export async function syncConnector(
  organizationId: string,
  connectorId: string,
): Promise<SyncResult> {
  const db = createServiceClient()
  const { data: connector } = await db
    .from("connectors")
    .select("*")
    .eq("id", connectorId)
    .eq("organization_id", organizationId)
    .single()

  if (!connector) throw new Error("connector not found")

  const cfg = connector as ConnectorConfig
  const result: SyncResult = {
    connector_id: connectorId,
    type: cfg.type,
    items_processed: 0,
    items_created: 0,
    errors: [],
    completed_at: new Date().toISOString(),
  }

  try {
    switch (cfg.type) {
      case "gmail":
        result.items_processed = await syncGmail(db, organizationId, cfg)
        break
      case "google_drive":
        result.items_processed = await syncGoogleDrive(db, organizationId, cfg)
        break
      case "slack":
        result.items_processed = await syncSlack(db, organizationId, cfg)
        break
    }

    await db
      .from("connectors")
      .update({ last_sync_at: result.completed_at })
      .eq("id", connectorId)
  } catch (err) {
    result.errors.push((err as Error).message)
  }

  return result
}

async function syncGmail(db: ReturnType<typeof createServiceClient>, organizationId: string, cfg: ConnectorConfig): Promise<number> {
  const accessToken = cfg.credentials.access_token as string
  if (!accessToken) throw new Error("no access token")

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`gmail api error: ${res.status}`)

  const { messages } = await res.json()
  if (!messages || !Array.isArray(messages)) return 0

  let count = 0
  for (const msg of messages.slice(0, 20)) {
    const detail = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!detail.ok) continue
    const { payload, snippet } = await detail.json()
    const from = payload?.headers?.find((h: { name: string }) => h.name === "From")?.value || ""
    const subject = payload?.headers?.find((h: { name: string }) => h.name === "Subject")?.value || ""

    await db.from("documents").insert({
      organization_id: organizationId,
      name: `Email: ${subject}`,
      type: "email",
      content: snippet || "",
      metadata: { source: "gmail", message_id: msg.id, from },
    }).maybeSingle()
    count++
  }
  return count
}

async function syncGoogleDrive(db: ReturnType<typeof createServiceClient>, organizationId: string, cfg: ConnectorConfig): Promise<number> {
  const accessToken = cfg.credentials.access_token as string
  if (!accessToken) throw new Error("no access token")

  const res = await fetch("https://www.googleapis.com/drive/v3/files?pageSize=20&q=mimeType!='application/vnd.google-apps.folder'", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`drive api error: ${res.status}`)

  const { files } = await res.json()
  if (!files || !Array.isArray(files)) return 0

  let count = 0
  for (const file of files.slice(0, 20)) {
    await db.from("documents").insert({
      organization_id: organizationId,
      name: file.name,
      type: "google_drive",
      metadata: { source: "google_drive", file_id: file.id, mime_type: file.mimeType },
      file_size: file.size ?? 0,
    }).maybeSingle()
    count++
  }
  return count
}

async function syncSlack(db: ReturnType<typeof createServiceClient>, organizationId: string, cfg: ConnectorConfig): Promise<number> {
  const token = cfg.credentials.bot_token as string
  if (!token) throw new Error("no slack token")

  const res = await fetch("https://slack.com/api/conversations.list?limit=20", {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`slack api error: ${res.status}`)

  const { channels } = await res.json()
  if (!channels || !Array.isArray(channels)) return 0

  let count = 0
  for (const channel of channels.slice(0, 10)) {
    const hist = await fetch(`https://slack.com/api/conversations.history?channel=${channel.id}&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!hist.ok) continue
    const { messages } = await hist.json()
    if (!messages || !Array.isArray(messages)) continue

    for (const msg of messages.slice(0, 5)) {
      await db.from("documents").insert({
        organization_id: organizationId,
        name: `Slack #${channel.name}`,
        type: "slack_message",
        content: msg.text || "",
        metadata: { source: "slack", channel: channel.name, channel_id: channel.id, ts: msg.ts, user: msg.user },
      }).maybeSingle()
      count++
    }
  }
  return count
}
