import { createHash } from "node:crypto"
import { createClient } from "@/lib/supabase/server"
import { TenantRegistrationData, TenantOnboardingResponse } from "@/lib/types"
import { v4 as uuidv4 } from "uuid"

/**
 * Get organization by ID with full tenant context
 */
export async function getTenantByOrganizationId(organizationId: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", organizationId)
      .single()

    if (error) {
      console.error("[v0] Error fetching organization:", error)
      return null
    }

    return data
  } catch (error) {
    console.error("[v0] Error in getTenantByOrganizationId:", error)
    return null
  }
}

/**
 * Get organization by slug
 */
export async function getTenantBySlug(slug: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("slug", slug)
      .single()

    if (error) {
      console.error("[v0] Error fetching organization by slug:", error)
      return null
    }

    return data
  } catch (error) {
    console.error("[v0] Error in getTenantBySlug:", error)
    return null
  }
}

/**
 * Create a unique slug from organization name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50)
}

/**
 * Register a new tenant and create all required tables/rows
 * Called during onboarding for new organizations
 */
export async function registerNewTenant(
  registrationData: TenantRegistrationData
): Promise<TenantOnboardingResponse | null> {
  try {
    const supabase = await createClient()
    const organizationId = uuidv4()
    const slug = generateSlug(registrationData.organizationName)

    // Start transaction-like behavior by creating all required rows

    // 1. Create organization
    const { error: orgError } = await supabase.from("organizations").insert({
      id: organizationId,
      name: registrationData.organizationName,
      slug,
      created_at: new Date().toISOString(),
    })

    if (orgError) {
      console.error("[v0] Error creating organization:", orgError)
      return null
    }

    console.log(`[v0] Created organization: ${organizationId}`)

    // 2. Create the profile linking the just-signed-up auth user to this org.
    // No DB trigger does this -- it has to happen here, and if it fails the
    // organization row above must be rolled back rather than left orphaned.
    const { error: profileError } = await supabase.from("profiles").insert({
      id: registrationData.userId,
      email: registrationData.email,
      full_name: registrationData.fullName,
      organization_id: organizationId,
      role: registrationData.role || "owner",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (profileError) {
      console.error("[v0] Error creating profile:", profileError)
      await supabase.from("organizations").delete().eq("id", organizationId)
      return null
    }

    // 3. Initialize onboarding progress
    const { error: onboardingError } = await supabase
      .from("onboarding_progress")
      .insert({
        id: uuidv4(),
        organization_id: organizationId,
        current_step: 0,
        total_steps: 5,
        setup_completed: false,
        created_at: new Date().toISOString(),
      })

    if (onboardingError) {
      console.error("[v0] Error creating onboarding progress:", onboardingError)
      await supabase.from("profiles").delete().eq("id", registrationData.userId)
      await supabase.from("organizations").delete().eq("id", organizationId)
      return null
    }

    console.log(`[v0] Created onboarding progress for organization: ${organizationId}`)

    // 4. Create API key for tenant
    const apiKeyId = uuidv4()
    const rawKey = `dk_${uuidv4().replace(/-/g, "")}${organizationId.substring(0, 8)}`
    const keyPrefix = rawKey.substring(0, 12)

    const { error: apiKeyError } = await supabase.from("api_keys").insert({
      id: apiKeyId,
      organization_id: organizationId,
      name: "Default API Key",
      key_prefix: keyPrefix,
      key_hash: createHash("sha256").update(rawKey).digest("hex"),
      scopes: ["read", "write"],
      created_at: new Date().toISOString(),
    })

    if (apiKeyError) {
      console.error("[v0] Error creating API key:", apiKeyError)
      // Don't fail the whole process if API key creation fails
    }

    console.log(`[v0] Created API key for organization: ${organizationId}`)

    // 5. Initialize usage tracking
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const { error: usageError } = await supabase.from("usage").insert({
      id: uuidv4(),
      organization_id: organizationId,
      metric: "api_calls",
      value: 0,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      created_at: now.toISOString(),
    })

    if (usageError) {
      console.error("[v0] Error creating usage tracking:", usageError)
      // Don't fail if usage tracking fails
    }

    console.log(`[v0] Tenant registration complete for: ${organizationId}`)

    return {
      tenantId: organizationId,
      organizationId,
      userId: registrationData.userId,
      jwtToken: "", // Will be populated from session
      organization: {
        id: organizationId,
        name: registrationData.organizationName,
        slug,
        createdAt: new Date().toISOString(),
      },
    }
  } catch (error) {
    console.error("[v0] Error in registerNewTenant:", error)
    return null
  }
}

/**
 * Verify tenant access for a user
 * Checks if user belongs to organization
 */
export async function verifyTenantAccess(
  userId: string,
  organizationId: string
): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .eq("organization_id", organizationId)
      .single()

    if (error || !data) {
      console.warn("[v0] Tenant access verification failed for user:", userId)
      return false
    }

    return true
  } catch (error) {
    console.error("[v0] Error verifying tenant access:", error)
    return false
  }
}

/**
 * Get all tenants for a user
 */
export async function getUserTenants(userId: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("profiles")
      .select("organization_id, organizations(id, name, slug)")
      .eq("id", userId)

    if (error) {
      console.error("[v0] Error fetching user tenants:", error)
      return []
    }

    return data || []
  } catch (error) {
    console.error("[v0] Error in getUserTenants:", error)
    return []
  }
}

export async function updateTenant(
  organizationId: string,
  updates: { name?: string; logo_url?: string },
) {
  try {
    const supabase = await createClient()
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (updates.name) patch.name = updates.name.trim()
    if (updates.logo_url !== undefined) patch.logo_url = updates.logo_url

    const { data, error } = await supabase
      .from("organizations")
      .update(patch)
      .eq("id", organizationId)
      .select()
      .single()

    if (error) {
      console.error("[v0] Error updating tenant:", error)
      return null
    }

    return data
  } catch (error) {
    console.error("[v0] Error in updateTenant:", error)
    return null
  }
}
