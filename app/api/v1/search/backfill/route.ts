import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { indexDocuments, type IndexableDocument } from "@/lib/search/index-helper"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"

/**
 * Backfill API (Module #4).
 * POST /api/v1/search/backfill -> bulk-index existing tenant records.
 *
 * Admin-only. Reads current rows for the caller's organization from the
 * existing tables (organizations, profiles, roles, teams) and indexes them.
 * Uses the service client but scopes every query by organization_id.
 */

export const POST = withAuth(
  async (req: NextRequest, ctx: AuthContext) => {
    const db = createServiceClient()
    const orgId = ctx.organizationId
    const docs: IndexableDocument[] = []

    // Organization itself
    const { data: org } = await db
      .from("organizations")
      .select("id, name, slug")
      .eq("id", orgId)
      .single()
    if (org) {
      docs.push({
        organizationId: orgId,
        resourceType: "organization",
        resourceId: org.id,
        title: org.name ?? org.slug ?? "Organization",
        body: org.slug ?? "",
        url: `/organization`,
      })
    }

    // Profiles (members)
    const { data: profiles } = await db
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("organization_id", orgId)
    for (const p of profiles ?? []) {
      docs.push({
        organizationId: orgId,
        resourceType: "profile",
        resourceId: p.id,
        title: p.full_name ?? p.email ?? "User",
        body: [p.email, p.role].filter(Boolean).join(" "),
        url: `/users/${p.id}`,
        metadata: { role: p.role },
      })
    }

    // Roles
    const { data: roles } = await db
      .from("roles")
      .select("id, name, description")
      .eq("organization_id", orgId)
    for (const r of roles ?? []) {
      docs.push({
        organizationId: orgId,
        resourceType: "role",
        resourceId: r.id,
        title: r.name,
        body: r.description ?? "",
        url: `/roles/${r.id}`,
      })
    }

    // Teams
    const { data: teams } = await db
      .from("teams")
      .select("id, name, description")
      .eq("organization_id", orgId)
    for (const t of teams ?? []) {
      docs.push({
        organizationId: orgId,
        resourceType: "team",
        resourceId: t.id,
        title: t.name,
        body: t.description ?? "",
        url: `/teams/${t.id}`,
      })
    }

    // Index in batches to keep request sizes reasonable.
    let indexed = 0
    const BATCH = 100
    for (let i = 0; i < docs.length; i += BATCH) {
      indexed += await indexDocuments(docs.slice(i, i + BATCH))
    }

    await logAuthEvent({
      action: "search.backfilled",
      userId: ctx.userId,
      organizationId: orgId,
      resourceType: "search",
      metadata: { indexed },
      ipAddress: getClientIp(req.headers),
    })

    return NextResponse.json({ indexed })
  },
  { requireAll: ["organization:write"] },
)
