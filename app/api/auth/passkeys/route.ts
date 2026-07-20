import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser, handleAuthError } from "@/lib/auth/server-auth"
import { createServiceClient } from "@/lib/supabase/service"

// GET /api/auth/passkeys -- list the authenticated user's registered passkeys
export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    const db = createServiceClient()
    const { data, error } = await db
      .from("passkeys")
      .select("id, device_name, created_at, last_used_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: "Unable to load passkeys" }, { status: 503 })
    }

    return NextResponse.json({ passkeys: data || [] })
  } catch (error) {
    if (error instanceof Error && ["Unauthorized", "Suspended"].includes(error.message)) {
      return handleAuthError(error)
    }
    return NextResponse.json({ error: "Unable to load passkeys" }, { status: 500 })
  }
}

// DELETE /api/auth/passkeys?id=<passkey-id> -- remove one of the
// authenticated user's own passkeys. Scoped by user_id so one account can
// never delete another's credential even if the id is guessed.
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const id = req.nextUrl.searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "Passkey id is required" }, { status: 400 })
    }

    const db = createServiceClient()
    const { error, count } = await db
      .from("passkeys")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: "Unable to remove passkey" }, { status: 503 })
    }
    if (!count) {
      return NextResponse.json({ error: "Passkey not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && ["Unauthorized", "Suspended"].includes(error.message)) {
      return handleAuthError(error)
    }
    return NextResponse.json({ error: "Unable to remove passkey" }, { status: 500 })
  }
}
