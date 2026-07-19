import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/with-auth'
import { createServiceClient } from '@/lib/supabase/service'

// Lightweight lookup used by the sidebar to personalize/reorder the module
// nav based on what the user picked (or the AI recommended) during
// onboarding -- see app/onboarding/recommendations/page.tsx's "complete"
// action, which is what writes profiles.selected_modules.
export const GET = withAuth(async (_req, { userId }) => {
  const db = createServiceClient()

  const { data: profile, error } = await db
    .from('profiles')
    .select('selected_modules')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ selectedModules: [] })
  }

  const selectedModules = Array.isArray(profile?.selected_modules) ? profile.selected_modules : []
  return NextResponse.json({ selectedModules })
})
