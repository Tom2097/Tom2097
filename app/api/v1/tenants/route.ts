import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/v1/tenants/verify
 * Verify tenant access for current user
 * Requires X-Tenant-ID header and valid session
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get("x-tenant-id")
    if (!tenantId) {
      return NextResponse.json(
        {
          error: "Missing tenant ID",
          message: "X-Tenant-ID header is required",
        },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "No active session",
        },
        { status: 401 }
      )
    }

    // Verify user belongs to tenant
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .eq("organization_id", tenantId)
      .single()

    if (profileError || !profile) {
      console.warn(
        `[v0] User ${user.id} attempted unauthorized access to tenant ${tenantId}`
      )
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "You do not have access to this tenant",
        },
        { status: 403 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          tenantId,
          userId: user.id,
          email: user.email,
          role: profile.role || "member",
        },
      },
      {
        status: 200,
        headers: {
          "X-Tenant-ID": tenantId,
        },
      }
    )
  } catch (error) {
    console.error("[v0] Tenant verification error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    )
  }
}
