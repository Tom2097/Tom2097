"use server"

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest } from 'next/server'
import type { TenantContextMiddleware } from './types'

// Re-export the server-only version
export async function extractTenantContext(
  _request?: NextRequest,
): Promise<TenantContextMiddleware | null> {
  try {
    const supabase = await createClient()
    const serviceDb = createServiceClient()

    // 1. Verify the session against the auth server (not just decode a token).
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('[v0] extractTenantContext: no user', { error: userError?.message, hasUser: !!user })
      return null
    }

    console.log('[v0] extractTenantContext: got user', user.id)

    // 2. Resolve org membership + base role from profiles via service client
    //    to bypass RLS policies that may not be configured yet.
    const { data: profile, error: profileError } = await serviceDb
      .from('profiles')
      .select('organization_id, role, team_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      console.error('[v0] extractTenantContext: no profile', { error: profileError?.message, userId: user.id })
      return null
    }

    console.log('[v0] extractTenantContext: got profile', { orgId: profile.organization_id, role: profile.role })

    // 3. Resolve the organization's plan and feature flags via service client.
    const { data: org, error: orgError } = await serviceDb
      .from('organizations')
      .select('plan_id, feature_flags, trial_ends_at, billing_period_ends_at')
      .eq('id', profile.organization_id)
      .maybeSingle()

    if (orgError || !org) {
      console.error('[v0] extractTenantContext: no org', { error: orgError?.message, orgId: profile.organization_id })
      return null
    }

    console.log('[v0] extractTenantContext: success', { userId: user.id, orgId: profile.organization_id })
    return {
      tenantId: profile.organization_id,
      organizationId: profile.organization_id,
      userId: user.id,
      email: user.email || '',
      teamId: profile.team_id || null,
      role: profile.role,
      planId: org.plan_id,
      featureFlags: org.feature_flags || [],
      trialEndsAt: org.trial_ends_at,
      billingPeriodEndsAt: org.billing_period_ends_at,
    }
  } catch (error) {
    console.error('[v0] extractTenantContext failed:', error)
    return null
  }
}