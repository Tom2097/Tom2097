import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { registerNewTenant } from "@/lib/multitenant/database"
import { TenantRegistrationData } from "@/lib/types"

/**
 * POST /api/v1/tenants/register
 * Register a new tenant and organization
 * 
 * Request body:
 * {
 *   organizationName: string
 *   email: string
 *   password: string
 *   fullName: string
 *   companyName?: string
 *   industry?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    const { organizationName, email, password, fullName } = body
    if (!organizationName || !email || !password || !fullName) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          message:
            "organizationName, email, password, and fullName are required",
        },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          error: "Invalid email",
          message: "Please provide a valid email address",
        },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        {
          error: "Weak password",
          message: "Password must be at least 8 characters",
        },
        { status: 400 }
      )
    }

    // Create Supabase client
    const supabase = await createClient()

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single()

    if (existingUser) {
      return NextResponse.json(
        {
          error: "Email already registered",
          message: "An account with this email already exists",
        },
        { status: 409 }
      )
    }

    // Sign up new user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          company_name: body.companyName,
        },
      },
    })

    if (authError || !authData.user) {
      console.error("[v0] Auth signup error:", authError)
      return NextResponse.json(
        {
          error: "Signup failed",
          message: authError?.message || "Failed to create account",
        },
        { status: 400 }
      )
    }

    const userId = authData.user.id

    // Register new tenant (creates organization, onboarding progress, etc.)
    const registrationData: TenantRegistrationData = {
      organizationName,
      email,
      password,
      fullName,
      companyName: body.companyName,
      industry: body.industry,
    }

    const tenantResponse = await registerNewTenant(registrationData)

    if (!tenantResponse) {
      console.error("[v0] Tenant registration failed for user:", userId)
      return NextResponse.json(
        {
          error: "Tenant registration failed",
          message: "Failed to complete tenant setup",
        },
        { status: 500 }
      )
    }

    // Get session to extract JWT
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      console.error("[v0] Session retrieval failed:", sessionError)
    }

    const jwtToken = session?.access_token || ""

    console.log(
      `[v0] Tenant registration successful: ${tenantResponse.organizationId}`
    )

    return NextResponse.json(
      {
        success: true,
        message: "Tenant registered successfully",
        data: {
          tenantId: tenantResponse.organizationId,
          organizationId: tenantResponse.organizationId,
          userId,
          organization: tenantResponse.organization,
          jwtToken,
        },
      },
      {
        status: 201,
        headers: {
          "X-Tenant-ID": tenantResponse.organizationId,
        },
      }
    )
  } catch (error) {
    console.error("[v0] Tenant registration error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred during registration",
      },
      { status: 500 }
    )
  }
}

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
