"use server"

import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { startTrial } from "@/lib/billing/subscription-lifecycle"
import { logAuthEvent } from "@/lib/auth/audit"
import { v4 as uuidv4 } from "uuid"
import { createHash } from "node:crypto"

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50)
}

// POST /api/auth/create-trial
// Creates an organization, profile, and trial subscription for a new user.
export async function POST(request: Request) {
  try {
    const { userId, email, fullName, companyName } = await request.json()

    if (!userId || !email) {
      return NextResponse.json(
        { error: "Missing required fields: userId, email" },
        { status: 400 }
      )
    }

    const db = createServiceClient()
    const organizationId = uuidv4()
    const slug = generateSlug(companyName || email.split("@")[0])

    // 1. Create organization
    const { error: orgError } = await db.from("organizations").insert({
      id: organizationId,
      name: companyName || email.split("@")[1] || "My Organization",
      slug,
      created_at: new Date().toISOString(),
    })

    if (orgError) {
      console.error("[v0] Error creating organization:", orgError)
      return NextResponse.json(
        { error: "Failed to create organization" },
        { status: 500 }
      )
    }

    // 2. Create or update profile
    const { error: profileError } = await db.from("profiles").upsert({
      id: userId,
      email,
      full_name: fullName || email.split("@")[0],
      organization_id: organizationId,
      role: "admin",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" })

    if (profileError) {
      console.error("[v0] Error creating profile:", profileError)
      return NextResponse.json(
        { error: "Failed to create profile" },
        { status: 500 }
      )
    }

    // 3. Start trial subscription
    const trialResult = await startTrial(organizationId, "professional", userId)
    if (!trialResult.success) {
      return NextResponse.json(
        { error: "Failed to start trial" },
        { status: 500 }
      )
    }

    // 4. Initialize onboarding progress
    const { error: onboardingError } = await db.from("onboarding_progress").insert({
      id: uuidv4(),
      organization_id: organizationId,
      current_step: 0,
      total_steps: 5,
      setup_completed: false,
      created_at: new Date().toISOString(),
    })

    if (onboardingError) {
      console.error("[v0] Error creating onboarding progress:", onboardingError)
      // Don't fail the whole process
    }

    // 5. Create API key
    const apiKeyId = uuidv4()
    const rawKey = `dk_${uuidv4().replace(/-/g, "")}${organizationId.substring(0, 8)}`
    const keyPrefix = rawKey.substring(0, 12)

    const { error: apiKeyError } = await db.from("api_keys").insert({
      id: apiKeyId,
      organization_id: organizationId,
      name: "Default API Key",
      key_prefix: keyPrefix,
      key_hash: createHash("sha256").update(rawKey).digest("hex"),
      scopes: ["read", "write"],
      created_at: new Date().toISOString(),
    })

    if (apiKeyError) {
      console.error("[v0] Error creating API key:", apiKeyError)
      // Don't fail the whole process
    }

    // 6. Initialize usage tracking
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const { error: usageError } = await db.from("usage").insert({
      id: uuidv4(),
      organization_id: organizationId,
      metric: "api_calls",
      value: 0,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      created_at: now.toISOString(),
    })

    if (usageError) {
      console.error("[v0] Error creating usage tracking:", usageError)
      // Don't fail the whole process
    }

    await logAuthEvent({
      action: "auth.trial_created",
      userId,
      organizationId,
      metadata: { email, companyName, fullName },
    })

    return NextResponse.json({
      success: true,
      organizationId,
      message: "Trial created successfully",
    })
  } catch (error) {
    console.error("[v0] Error creating trial:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred while creating your trial" },
      { status: 500 }
    )
  }
}
