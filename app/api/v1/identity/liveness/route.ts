import { NextResponse } from "next/server"
import { logger } from "@/lib/logging"

/**
 * Mock liveness detection API
 */
export async function POST(request: Request) {
  try {
    const { image } = await request.json()
    
    if (!image) {
      return NextResponse.json(
        { error: "Image is required" },
        { status: 400 }
      )
    }
    
    // Simulate liveness detection
    const isLive = Math.random() > 0.1 // 90% chance of passing
    const confidence = isLive ? 0.95 : 0.3
    
    logger.logInfo("[liveness] Mock liveness check", { isLive, confidence })
    
    return NextResponse.json({ live: isLive, confidence })
  } catch (err) {
    logger.logError("[liveness] Liveness check failed:", { error: err })
    return NextResponse.json(
      { error: "Liveness check failed" },
      { status: 500 }
    )
  }
}