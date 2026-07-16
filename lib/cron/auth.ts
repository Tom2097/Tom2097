import type { NextRequest } from "next/server"

/**
 * Shared auth check for scheduled-job routes. Vercel Cron requests carried an
 * implicit platform signature; a Coolify (or any external) scheduler has no
 * such thing, so these routes are guarded by a bearer token instead. Set
 * CRON_SECRET in the environment and configure the scheduler to send
 * `Authorization: Bearer <CRON_SECRET>`.
 */
export function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get("authorization")
  return header === `Bearer ${secret}`
}
