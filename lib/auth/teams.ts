import { createServiceClient } from "@/lib/supabase/service"

/**
 * Teams / groups library (Module #3).
 * Tenant-scoped teams whose assigned roles are inherited by all members.
 * All functions scope by organization_id manually because the service client
 * bypasses RLS — callers must validate tenant + permissions via withAuth first.
 */

export interface Team {
  id: string
  organization_id: string
  name: string
  description: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  organization_id: string
  created_at: string
}

/** List all teams in an organization. */
export async function listTeams(organizationId: string): Promise<Team[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("teams")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })

  if (error) {
    console.log("[v0] listTeams error:", error.message)
    return []
  }
  return data ?? []
}

/** Get a single team (org-scoped) with members and assigned role ids. */
export async function getTeam(organizationId: string, teamId: string) {
  const db = createServiceClient()
  const { data: team, error } = await db
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .eq("organization_id", organizationId)
    .single()

  if (error || !team) {
    console.log("[v0] getTeam error:", error?.message)
    return null
  }

  const { data: members } = await db
    .from("team_members")
    .select("user_id, created_at")
    .eq("team_id", teamId)

  const { data: roles } = await db.from("team_roles").select("role_id").eq("team_id", teamId)

  return {
    ...team,
    members: members ?? [],
    roleIds: (roles ?? []).map((r: { role_id: string }) => r.role_id),
  }
}

/** Create a team. */
export async function createTeam(
  organizationId: string,
  name: string,
  description: string | null,
  createdBy: string,
): Promise<Team | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("teams")
    .insert({ organization_id: organizationId, name, description, created_by: createdBy })
    .select()
    .single()

  if (error) {
    console.log("[v0] createTeam error:", error.message)
    return null
  }
  return data
}

/** Update a team's name/description. */
export async function updateTeam(
  organizationId: string,
  teamId: string,
  updates: { name?: string; description?: string | null },
): Promise<Team | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("teams")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", teamId)
    .eq("organization_id", organizationId)
    .select()
    .single()

  if (error) {
    console.log("[v0] updateTeam error:", error.message)
    return null
  }
  return data
}

/** Delete a team (cascades members and team roles). */
export async function deleteTeam(organizationId: string, teamId: string): Promise<boolean> {
  const db = createServiceClient()
  const { error } = await db.from("teams").delete().eq("id", teamId).eq("organization_id", organizationId)
  if (error) {
    console.log("[v0] deleteTeam error:", error.message)
    return false
  }
  return true
}

/** Add a user to a team. */
export async function addTeamMember(
  organizationId: string,
  teamId: string,
  userId: string,
  addedBy: string,
): Promise<boolean> {
  const db = createServiceClient()

  // Verify team belongs to org
  const { data: team } = await db
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .eq("organization_id", organizationId)
    .single()
  if (!team) return false

  const { error } = await db.from("team_members").upsert(
    { team_id: teamId, user_id: userId, organization_id: organizationId, added_by: addedBy },
    { onConflict: "team_id,user_id" },
  )

  if (error) {
    console.log("[v0] addTeamMember error:", error.message)
    return false
  }
  return true
}

/** Remove a user from a team. */
export async function removeTeamMember(
  organizationId: string,
  teamId: string,
  userId: string,
): Promise<boolean> {
  const db = createServiceClient()
  const { error } = await db
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("organization_id", organizationId)

  if (error) {
    console.log("[v0] removeTeamMember error:", error.message)
    return false
  }
  return true
}

/** Assign a role to a team (members inherit its permissions). */
export async function assignRoleToTeam(
  organizationId: string,
  teamId: string,
  roleId: string,
): Promise<boolean> {
  const db = createServiceClient()

  // Verify both team and role belong to the org
  const [{ data: team }, { data: role }] = await Promise.all([
    db.from("teams").select("id").eq("id", teamId).eq("organization_id", organizationId).single(),
    db.from("roles").select("id").eq("id", roleId).eq("organization_id", organizationId).single(),
  ])
  if (!team || !role) return false

  const { error } = await db.from("team_roles").upsert(
    { team_id: teamId, role_id: roleId, organization_id: organizationId },
    { onConflict: "team_id,role_id" },
  )

  if (error) {
    console.log("[v0] assignRoleToTeam error:", error.message)
    return false
  }
  return true
}

/** Remove a role from a team. */
export async function removeRoleFromTeam(
  organizationId: string,
  teamId: string,
  roleId: string,
): Promise<boolean> {
  const db = createServiceClient()
  const { error } = await db
    .from("team_roles")
    .delete()
    .eq("team_id", teamId)
    .eq("role_id", roleId)
    .eq("organization_id", organizationId)

  if (error) {
    console.log("[v0] removeRoleFromTeam error:", error.message)
    return false
  }
  return true
}
