import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const feedbackSchema = z.object({
  rating: z.number().min(1).max(5),
  comments: z.string().optional(),
  userId: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { rating, comments, userId } = feedbackSchema.parse(body)

    const supabase = createServiceClient()

    const { error } = await supabase.from('feedback').insert({
      rating,
      comments: comments || null,
      user_id: userId || null,
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