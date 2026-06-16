import { NextRequest, NextResponse } from "next/server"
import {
  withTenantContext,
  TenantContextMiddleware,
} from "@/lib/multitenant/context"
import { checkTenantRateLimit, addRateLimitHeaders } from "@/lib/multitenant/rate-limit"
import { getTenantByOrganizationId } from "@/lib/multitenant/database"

/**
 * GET /api/v1/tenants/[tenantId]/info
 * Get organization information for a tenant
 * Protected by tenant context middleware
 * 
 * Required headers:
 * - X-Tenant-ID: Organization ID
 * - Authorization: Bearer <JWT_TOKEN>
 */
async function getTenantInfo(
  request: NextRequest,
  tenantContext: TenantContextMiddleware
) {
  try {
    // Check rate limit
    const rateLimitResponse = await checkTenantRateLimit(tenantContext.tenantId)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // Fetch tenant organization details
    const tenant = await getTenantByOrganizationId(
      tenantContext.organizationId
    )

    if (!tenant) {
      return NextResponse.json(
        {
          error: "Not found",
          message: "Organization not found",
        },
        { status: 404 }
      )
    }

    const response = NextResponse.json(
      {
        success: true,
        data: {
          tenantId: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          createdAt: tenant.created_at,
          updatedAt: tenant.updated_at,
          user: {
            userId: tenantContext.userId,
            email: tenantContext.email,
            role: tenantContext.role,
          },
        },
      },
      { status: 200 }
    )

    return await addRateLimitHeaders(response, tenantContext.tenantId)
  } catch (error) {
    console.error("[v0] Error fetching tenant info:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    )
  }
}

export const GET = withTenantContext(getTenantInfo)

/**
 * PATCH /api/v1/tenants/[tenantId]/info
 * Update organization information for a tenant
 * Only admin users can update
 * Protected by tenant context middleware
 */
async function updateTenantInfo(
  request: NextRequest,
  tenantContext: TenantContextMiddleware
) {
  try {
    // Check rate limit
    const rateLimitResponse = await checkTenantRateLimit(tenantContext.tenantId)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // Only admins can update
    if (tenantContext.role !== "admin") {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "Only administrators can update organization information",
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, logoUrl } = body

    // Validate input
    if (!name && !logoUrl) {
      return NextResponse.json(
        {
          error: "Invalid request",
          message: "Provide at least one field to update",
        },
        { status: 400 }
      )
    }

    // TODO: Update organization in database using Supabase service client
    // This is left as placeholder - actual update would happen here

    const response = NextResponse.json(
      {
        success: true,
        message: "Organization updated successfully",
        data: {
          tenantId: tenantContext.organizationId,
          name,
          logoUrl,
        },
      },
      { status: 200 }
    )

    return await addRateLimitHeaders(response, tenantContext.tenantId)
  } catch (error) {
    console.error("[v0] Error updating tenant info:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    )
  }
}

export const PATCH = withTenantContext(updateTenantInfo)
