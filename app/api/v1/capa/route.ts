import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/auth/with-auth"
import { createCapa, transitionCapa, type CapaRecord, type CapaState } from "@/lib/capa/fsm"

const capaStore: Map<string, CapaRecord> = new Map()

const STATES = ["Open", "Investigation", "Action", "Verification", "Closed"] as const

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  category: z.enum(["Customer", "Process", "Product", "System", "Compliance", "Safety"]),
  priority: z.enum(["Critical", "High", "Medium", "Low"]),
  assignedTo: z.string().min(1),
  dueDate: z.string().datetime().optional(),
})

const transitionSchema = z.object({
  capaId: z.string().min(1),
  toState: z.enum(STATES),
  comment: z.string().optional(),
})

const WRITE = { requireAny: ["capas:write", "compliance:write"] }
const READ = { requireAny: ["capas:read", "compliance:read"] }

// Organization and author always come from the authenticated caller, never the
// request body, so one tenant cannot create or read records for another.
export const POST = withAuth(async (req, context) => {
  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid CAPA" }, { status: 400 })

  const { title, description, category, priority, assignedTo, dueDate } = parsed.data
  const capa = createCapa(
    title,
    description,
    category,
    priority,
    context.organizationId,
    context.userId,
    assignedTo,
    dueDate ? new Date(dueDate) : undefined,
  )
  capaStore.set(capa.id, capa)
  return NextResponse.json(capa)
}, WRITE)

export const PUT = withAuth(async (req, context) => {
  const parsed = transitionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid transition" }, { status: 400 })

  const { capaId, toState, comment } = parsed.data
  const capa = capaStore.get(capaId)
  if (!capa || capa.organizationId !== context.organizationId) {
    return NextResponse.json({ error: "CAPA not found" }, { status: 404 })
  }

  const result = transitionCapa(capa, toState, context.userId, comment)
  if (!result.success) return NextResponse.json({ error: result.reason }, { status: 400 })
  capaStore.set(capaId, result.updated!)
  return NextResponse.json(result.updated)
}, WRITE)

export const GET = withAuth(async (req, context) => {
  const state = req.nextUrl.searchParams.get("state") as CapaState | null
  let caps = Array.from(capaStore.values()).filter((c) => c.organizationId === context.organizationId)
  if (state) caps = caps.filter((c) => c.state === state)
  return NextResponse.json(caps)
}, READ)
