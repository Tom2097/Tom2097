import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const trialSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().min(1).optional(),
  companyName: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, email, companyName } = trialSchema.parse(body)

    const supabase = createServiceClient()

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: companyName,
        email,
        created_by: userId,
      })
      .select('id')
      .single()

    if (orgError || !org) {
      throw new Error(orgError?.message || 'Failed to create organization')
    }

    // Create subscription with trial
    const { error: subError } = await supabase
      .from('subscriptions')
      .insert({
        organization_id: org.id,
        status: 'trialing',
        trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        user_id: userId,
      })

    if (subError) {
      throw new Error(subError.message)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[create-trial] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create trial' },
      { status: 500 }
    )
  }
}