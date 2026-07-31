import { createServiceClient } from "@/lib/supabase/service"
import { publish } from "@/lib/events/bus"
import { broadcast } from "@/lib/notifications/engine"

export async function runScheduledChecks(organizationId: string): Promise<{ expired: number; expiring: number }> {
  const db = createServiceClient()
  const now = new Date()
  const in30Days = new Date(now.getTime() + 30 * 86400000).toISOString()

  const { data: certs } = await db
    .from("compliance_certificates")
    .select("*")
    .eq("organization_id", organizationId)
    .lte("expiry_date", in30Days)

  let expired = 0
  let expiring = 0

  for (const cert of (certs ?? []) as Array<{ id: string; name: string; expiry_date: string }>) {
    const daysRemaining = Math.ceil((new Date(cert.expiry_date).getTime() - now.getTime()) / 86400000)
    if (daysRemaining <= 0) {
      expired++
      try {
        await broadcast(organizationId, {
          type: "error",
          category: "cert_expired",
          title: `Certificate expired: ${cert.name}`,
          data: { cert_id: cert.id, name: cert.name },
          source: "system",
        })
      } catch (err) {
        console.error("[v0] cert_expired notification failed:", (err as Error).message)
      }
      await publish({ type: "compliance.cert_expiring", organization_id: organizationId, data: { cert_id: cert.id, days_remaining: 0 } })
    } else {
      expiring++
      try {
        await broadcast(organizationId, {
          type: "warning",
          category: "cert_expiring",
          title: `Certificate expiring in ${daysRemaining} days: ${cert.name}`,
          data: { cert_id: cert.id, name: cert.name, days_remaining: daysRemaining },
          source: "system",
        })
      } catch (err) {
        console.error("[v0] cert_expiring notification failed:", (err as Error).message)
      }
      await publish({ type: "compliance.cert_expiring", organization_id: organizationId, data: { cert_id: cert.id, days_remaining: daysRemaining } })
    }
  }

  return { expired, expiring }
}
