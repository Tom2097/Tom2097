import { NextResponse } from 'next/server'
import { z } from 'zod'

const feedbackSchema = z.object({
  rating: z.number().min(1).max(5),
  comments: z.string().optional(),
  userId: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = feedbackSchema.parse(body)

    // TODO: Store feedback in database (e.g., Supabase)
    console.log('Feedback received:', parsed)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid feedback data' },
      { status: 400 }
    )
  }
}