import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser, handleAuthError } from "@/lib/auth/server-auth"
import {
  consumePasscode,
  verifyDeviceBinding,
  isDeviceRateLimited,
  getNewDeviceDeadEndConfig,
} from "@/lib/auth/device-replay"

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const body = await request.json()
    const { passcode, deviceId } = body

    if (!passcode || !deviceId) {
      return NextResponse.json({ error: "Passcode and deviceId are required" }, { status: 400 })
    }

    // Check rate limiting
    const limited = await isDeviceRateLimited(deviceId)
    if (limited) {
      return NextResponse.json({
        error: "Too many attempts. Device is temporarily blocked.",
        blocked: true,
        cooldownMinutes: 15,
      }, { status: 429 })
    }

    // Verify device binding
    const binding = await verifyDeviceBinding(user.id, deviceId)
    if (!binding.bound && binding.knownDevice === false) {
      const config = await getNewDeviceDeadEndConfig()
      if (config.enabled) {
        return NextResponse.json({
          error: "Unknown device. Please use SSO or re-enroll.",
          deadEnd: true,
          ssoFallback: config.ssoFallbackEnabled,
        }, { status: 403 })
      }
    }

    // Consume passcode (validates against the issued token, then anti-replay)
    const { valid, replayDetected } = await consumePasscode(
      user.id,
      passcode,
      deviceId
    )

    if (replayDetected) {
      return NextResponse.json({
        error: "Passcode already used. This attempt has been logged.",
        replayDetected: true,
      }, { status: 409 })
    }

    if (!valid) {
      return NextResponse.json({ error: "Invalid passcode" }, { status: 401 })
    }

    return NextResponse.json({ success: true, deviceVerified: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function GET() {
  const config = await getNewDeviceDeadEndConfig()
  return NextResponse.json({ config })
}
