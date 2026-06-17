import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isPlatformOwnerEmail } from "@/lib/platform/owner"

// Lightweight check used by the sidebar to decide whether to show the
// founder-only navigation entry. Returns { isOwner: boolean }.
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return NextResponse.json({ isOwner: isPlatformOwnerEmail(user?.email) })
}
