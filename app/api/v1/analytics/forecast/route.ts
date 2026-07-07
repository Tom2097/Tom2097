"use server"

import { type NextRequest, NextResponse } from "next/server"
import { generateForecast } from "@/lib/analytics/forecast"
import { withAuth } from "@/lib/auth/with-auth"
import { logger } from "@/lib/logging"

/**
 * GET /api/v1/analytics/forecast
 * 
 * Returns forecasted values for a metric
 */
export const GET = withAuth(async (request: NextRequest, context) => {
  const { searchParams } = new URL(request.url)
  const eventName = searchParams.get("eventName")
  const start = searchParams.get("start")
  const end = searchParams.get("end")
  const periods = searchParams.get("periods") ? Number(searchParams.get("periods")) : undefined
  const useAI = searchParams.get("useAI") === "true"

  if (!eventName || !start || !end) {
    return NextResponse.json(
      { success: false, error: "Missing required parameters: eventName, start, end" },
      { status: 400 }
    )
  }

  try {
    const result = await generateForecast(
      context.organizationId,
      eventName,
      { start, end },
      { periods, useAI }
    )

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    logger.logError("[API] Error generating forecast:", error instanceof Error ? { message: error.message } : { error: String(error) })
    return NextResponse.json(
      { success: false, error: "Failed to generate forecast" },
      { status: 500 }
    )
  }
})
