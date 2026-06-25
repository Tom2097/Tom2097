import { NextRequest, NextResponse } from "next/server"
import { createCapa, transitionCapa, type CapaRecord, type CapaState, type CapaCategory, type CapaPriority } from "@/lib/capa/fsm"

const capaStore: Map<string, CapaRecord> = new Map()

export async function POST(req: NextRequest) {
  try {
    const { title, description, category, priority, organizationId, createdBy, assignedTo, dueDate } = await req.json()
    const capa = createCapa(title, description, category as CapaCategory, priority as CapaPriority, organizationId, createdBy, assignedTo, dueDate ? new Date(dueDate) : undefined)
    capaStore.set(capa.id, capa)
    return NextResponse.json(capa)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { capaId, toState, by, comment } = await req.json()
    const capa = capaStore.get(capaId)
    if (!capa) return NextResponse.json({ error: "CAPA not found" }, { status: 404 })
    const result = transitionCapa(capa, toState as CapaState, by, comment)
    if (!result.success) return NextResponse.json({ error: result.reason }, { status: 400 })
    capaStore.set(capaId, result.updated!)
    return NextResponse.json(result.updated)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const organizationId = sp.get("organizationId")
  const state = sp.get("state") as CapaState | null
  let caps = Array.from(capaStore.values())
  if (organizationId) caps = caps.filter((c) => c.organizationId === organizationId)
  if (state) caps = caps.filter((c) => c.state === state)
  return NextResponse.json(caps)
}
