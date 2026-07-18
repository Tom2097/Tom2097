import { NextResponse } from "next/server"
import { logger } from "@/lib/logging"
import { getAuthenticatedUser, handleAuthError } from "@/lib/auth/server-auth"

/**
 * Mock liveness detection API
 */
export async function POST(request: Request) {
  try {
    await getAuthenticatedUser()

    const { image } = await request.json()
    
    if (!image) {
      return NextResponse.json(
        { error: "Image is required" },
        { status: 400 }
      )
    }
    
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Liveness verification provider is not configured" },
        { status: 503 }
      )
    }

    // Explicit development-only demo result. It must never be interpreted as
    // an actual identity-verification decision.
    const isLive = Math.random() > 0.1 // 90% chance of passing
    const confidence = isLive ? 0.95 : 0.3
    
    logger.logInfo("[liveness] Mock liveness check", { isLive, confidence })
    
    return NextResponse.json({ live: isLive, confidence, simulated: true })
  } catch (err) {
    if (err instanceof Error && ["Unauthorized", "Suspended"].includes(err.message)) {
      return handleAuthError(err)
    }
    logger.logError("[liveness] Liveness check failed:", { error: err })
    return NextResponse.json(
      { error: "Liveness check failed" },
      { status: 500 }
    )
  }
}
