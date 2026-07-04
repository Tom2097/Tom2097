import { withAuth } from "@/lib/auth/with-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { v4 as uuidv4 } from "uuid"
import { createHash } from "node:crypto"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"
import { NextResponse } from "next/server"

export const GET = withAuth(async (req, { organizationId }) => {
  const supabase = createServiceClient()

  const { data: keys } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, scopes, created_at, last_used_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })

  return NextResponse.json({ keys: keys || [] })
})

export const POST = withAuth(async (req, { organizationId, userId }) => {
  const { name, scopes } = await req.json()

  const apiKeyId = uuidv4()
  const rawKey = `dk_${uuidv4().replace(/-/g, "")}${organizationId.substring(0, 8)}`
  const keyPrefix = rawKey.substring(0, 12)

  const supabase = createServiceClient()

  const { error } = await supabase.from("api_keys").insert({
    id: apiKeyId,
    organization_id: organizationId,
    name: name || "API Key",
    key_prefix: keyPrefix,
    key_hash: createHash("sha256").update(rawKey).digest("hex"),
    scopes: scopes || ["read", "write"],
    created_by: userId,
  })

  if (error) {
    return NextResponse.json({ error: "Failed to generate key" }, { status: 500 })
  }

  await logAuthEvent({
    action: "auth.api_key_generated",
    userId,
    organizationId: organizationId ?? undefined,
    resourceId: apiKeyId,
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({ key: rawKey, id: apiKeyId, name: name || "API Key" }, { status: 201 })
})

export const DELETE = withAuth(async (req, { organizationId, userId }) => {
  const { id } = await req.json()

  if (!id) {
    return NextResponse.json({ error: "Key ID is required" }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from("api_keys")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    return NextResponse.json({ error: "Failed to delete key" }, { status: 500 })
  }

  await logAuthEvent({
    action: "auth.api_key_revoked",
    userId,
    organizationId: organizationId ?? undefined,
    resourceId: id,
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({ success: true })
})
