import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { getOrganizationId } from '@/lib/auth/server-auth'
import { checkTenantRateLimit } from '@/lib/multitenant/rate-limit'
import { getClientIp } from '@/lib/auth/audit'

const feedbackSchema = z.object({
  rating: z.number().min(1).max(5),
  comments: z.string().trim().max(5000).optional(),
})

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request.headers) ?? 'unknown'
    const limited = await checkTenantRateLimit(`feedback-ip:${clientIp}`, 100, 10)
    if (limited) return limited

    const body = await request.json()
    const { rating, comments } = feedbackSchema.parse(body)

    // Feedback may be anonymous, but a caller must never be able to attribute
    // it to another account. Use only a session identity verified by Supabase.
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()

    // Best-effort org resolution -- this widget is reachable while
    // unauthenticated (see components/navbar.tsx), so a missing org is
    // expected and shouldn't block submission.
    let organizationId: string | null = null
    if (user?.id) {
      try {
        organizationId = await getOrganizationId(user.id)
      } catch {
        organizationId = null
      }
    }

    const supabase = createServiceClient()

    // This is a lightweight NPS-style rating widget, not the structured
    // feedback/feature-request engine in lib/feedback/engine.ts -- it has
    // its own distinctly-named table (nps_responses) so it can't collide
    // with or corrupt the org-scoped "feedback" table that engine reads.
    const { error } = await supabase.from('nps_responses').insert({
      organization_id: organizationId,
      rating,
      comments: comments || null,
      user_id: user?.id || null,
    })

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[feedback] Error:', error)
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}
