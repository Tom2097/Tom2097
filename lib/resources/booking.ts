import { createServiceClient } from "@/lib/supabase/service"

export interface Booking {
  id: string; organization_id: string; resource_id: string; resource_type: string
  title: string; start_time: string; end_time: string; status: "confirmed" | "pending" | "cancelled"
  booked_by: string; created_at: string
}

export async function listBookings(organizationId: string, resourceId?: string): Promise<Booking[]> {
  const db = createServiceClient()
  let q = db.from("resource_bookings").select("*").eq("organization_id", organizationId).order("start_time", { ascending: false })
  if (resourceId) q = q.eq("resource_id", resourceId)
  const { data } = await q
  return (data ?? []) as Booking[]
}

export async function checkConflicts(organizationId: string, resourceId: string, start: string, end: string): Promise<Booking[]> {
  const db = createServiceClient()
  const { data } = await db.from("resource_bookings")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("resource_id", resourceId)
    .eq("status", "confirmed")
    .lt("start_time", end)
    .gt("end_time", start)
  return (data ?? []) as Booking[]
}

export async function createBooking(organizationId: string, input: Omit<Booking, "id" | "created_at">): Promise<Booking | null> {
  const conflicts = await checkConflicts(organizationId, input.resource_id, input.start_time, input.end_time)
  if (conflicts.length > 0) return null
  const db = createServiceClient()
  const { data, error } = await db.from("resource_bookings").insert({ ...input, organization_id: organizationId }).select("*").single()
  if (error) return null
  return data as Booking
}
