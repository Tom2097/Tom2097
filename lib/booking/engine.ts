import { createServiceClient } from "@/lib/supabase/service"

export interface BookingSlot {
  id: string
  organization_id: string
  resource_id: string
  resource_type: string
  title: string
  start_time: string
  end_time: string
  status: "available" | "booked" | "maintenance"
  booked_by: string | null
  created_at: string
}

export interface BookingInput {
  resourceId: string
  resourceType: string
  title: string
  startTime: string
  endTime: string
}

export async function listSlots(organizationId: string, date?: string): Promise<BookingSlot[]> {
  const supabase = createServiceClient()
  let query = supabase
    .from("booking_slots")
    .select("*")
    .eq("organization_id", organizationId)
    .order("start_time", { ascending: true })

  if (date) {
    const start = `${date}T00:00:00Z`
    const end = `${date}T23:59:59Z`
    query = query.gte("start_time", start).lte("end_time", end)
  }

  const { data } = await query
  return (data ?? []) as BookingSlot[]
}

export async function createSlot(organizationId: string, userId: string, input: BookingInput): Promise<BookingSlot | null> {
  const supabase = createServiceClient()

  const { data: conflict } = await supabase
    .from("booking_slots")
    .select("id")
    .eq("resource_id", input.resourceId)
    .eq("organization_id", organizationId)
    .eq("status", "booked")
    .lte("start_time", input.endTime)
    .gte("end_time", input.startTime)
    .maybeSingle()

  if (conflict) throw new Error("Time slot conflicts with an existing booking")

  const { data, error } = await supabase
    .from("booking_slots")
    .insert({
      organization_id: organizationId,
      resource_id: input.resourceId,
      resource_type: input.resourceType,
      title: input.title,
      start_time: input.startTime,
      end_time: input.endTime,
      status: "booked",
      booked_by: userId,
    })
    .select("*")
    .single()

  if (error) throw error
  return data as BookingSlot
}

export async function cancelSlot(organizationId: string, slotId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from("booking_slots")
    .update({ status: "available", booked_by: null })
    .eq("id", slotId)
    .eq("organization_id", organizationId)
  return !error
}
