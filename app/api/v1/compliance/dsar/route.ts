import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { hasAnyPermission } from "@/lib/auth/rbac"
import {
  createDsarRequest,
  executeDsarExport,
  executeDsarDelete,
  executeDsarRectify,
  executeDsarRestrict,
  listDsarRequests,
  updateDsarStatus,
  recordConsent,
  revokeConsent,
  listConsentRecords,
  DSAR_RECTIFIABLE_FIELDS,
  isDsarRectifiableField,
} from "@/lib/compliance/dsar"

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const body = await request.json()

    switch (body.action) {
      case "create": {
        const subjectEmail = typeof body.subjectEmail === "string" && body.subjectEmail.trim() ? body.subjectEmail.trim() : user.email!
        const dsar = await createDsarRequest(organizationId, subjectEmail, body.requestType)
        if (!dsar) {
          return NextResponse.json({ error: "Failed to create DSAR request" }, { status: 500 })
        }
        return NextResponse.json({ dsar })
      }
      case "export": {
        const data = await executeDsarExport(organizationId, user.id)
        return NextResponse.json({ data })
      }
      case "delete": {
        await executeDsarDelete(organizationId, user.id)
        return NextResponse.json({ success: true })
      }
      case "rectify": {
        if (typeof body.field !== "string" || !isDsarRectifiableField(body.field)) {
          return NextResponse.json(
            { error: `field must be one of: ${DSAR_RECTIFIABLE_FIELDS.join(", ")}` },
            { status: 400 },
          )
        }
        if (typeof body.value !== "string") {
          return NextResponse.json({ error: "value must be a string" }, { status: 400 })
        }
        const success = await executeDsarRectify(organizationId, user.id, body.field, body.value)
        return NextResponse.json({ success })
      }
      case "restrict": {
        const success = await executeDsarRestrict(organizationId, user.id, body.restricted)
        return NextResponse.json({ success })
      }
      case "consent": {
        if (body.revoke) {
          const success = await revokeConsent(organizationId, user.id, body.purpose)
          return NextResponse.json({ success })
        }
        const success = await recordConsent(organizationId, user.id, body.purpose, body.ipAddress, body.userAgent)
        return NextResponse.json({ success })
      }
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { searchParams } = new URL(request.url)
    
    const type = searchParams.get("type")
    
    if (type === "requests") {
      // Lists every DSAR request in the org (not just the caller's own) —
      // this is a compliance-officer view, so it needs elevated permission.
      if (!(await hasAnyPermission(user.id, ["dsar:read", "compliance:read"]))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      const requests = await listDsarRequests(organizationId)
      return NextResponse.json({ requests })
    }

    if (type === "consent") {
      // Can return consent records for any user in the org (or all of them,
      // when userId is omitted) — same reasoning as above.
      if (!(await hasAnyPermission(user.id, ["dsar:read", "compliance:read"]))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      const userId = searchParams.get("userId") || undefined
      const records = await listConsentRecords(organizationId, userId)
      return NextResponse.json({ records })
    }

    if (type === "export") {
      const data = await executeDsarExport(organizationId, user.id)
      return NextResponse.json({ data })
    }
    
    return NextResponse.json({ error: "Invalid type" }, { status: 400 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const body = await request.json()

    if (typeof body.requestId !== "string" || !body.requestId) {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 })
    }

    // Transitioning the status of a DSAR case is a compliance-officer action,
    // not a self-service one — require elevated permission.
    if (!(await hasAnyPermission(user.id, ["dsar:write", "compliance:write"]))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const success = await updateDsarStatus(organizationId, body.requestId, body.status)
    if (!success) {
      return NextResponse.json({ error: "DSAR request not found" }, { status: 404 })
    }
    return NextResponse.json({ success })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
