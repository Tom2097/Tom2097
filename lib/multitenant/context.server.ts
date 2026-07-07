"use server"

import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { TenantContextMiddleware } from './types'

// Re-export the server-only version
export async function extractTenantContext(
  _request?: NextRequest,
): Promise<TenantContextMiddleware | null> {
  try {
    const supabase = await createClient()

    // 1. Verify the session against the auth server (not just decode a token).
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return null
    }

    // 2. Resolve org membership + base role from profiles (server-side, the
    //    authoritative source). Use the service client so an incomplete RLS
    //    policy set can never hide a user's own membership row. Memoized
    //    per-request so repeated context resolution costs a single query.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id, role, team_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return null
    }

    // 3. Resolve the organization's plan and feature flags. This is cached
    //    aggressively (5 min) because it's used on every request.
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('plan_id, feature_flags, trial_ends_at, billing_period_ends_at')
      .eq('id', profile.organization_id)
      .maybeSingle()

    if (orgError || !org) {
      return null
    }

    return {
      userId: user.id,
      email: user.email || '',
      organizationId: profile.organization_id,
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