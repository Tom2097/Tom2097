// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("server-only", () => ({}))

const tenant = vi.hoisted(() => ({ current: null as null | Record<string, unknown>, permissions: [] as string[] }))
const whatsapp = vi.hoisted(() => ({ send: vi.fn(async () => "wamid-1") }))
const intake = vi.hoisted(() => ({ ingest: vi.fn(async () => ["doc-1"]) }))

vi.mock("@/lib/multitenant/context.server", () => ({ extractTenantContext: async () => tenant.current }))
vi.mock("@/lib/auth/rbac", () => ({ getUserPermissions: async () => tenant.permissions }))
vi.mock("@/lib/auth/api-key", () => ({ resolveApiKeyAuth: async () => null, apiKeyPermits: () => false }))
vi.mock("@/lib/auth/audit", () => ({ logAuthEvent: async () => undefined, getClientIp: () => "127.0.0.1" }))
vi.mock("@/lib/multitenant/rate-limit", () => ({ checkTenantRateLimit: async () => null }))
vi.mock("../lib/crm/whatsapp", () => ({
  sendWhatsAppMessage: whatsapp.send,
  logWhatsAppToDeal: vi.fn(),
  getWhatsAppTemplates: () => [],
}))
vi.mock("@/lib/operational/intake", () => ({ ingestFromEmail: intake.ingest }))

import * as capaRoute from "@/app/api/v1/capa/route"
import * as ragRoute from "@/app/api/v1/rag/route"
import * as enterpriseRoute from "@/app/api/v1/enterprise/route"
import * as whatsappRoute from "@/app/api/v1/crm/whatsapp/route"
import * as ingestRoute from "@/app/api/v1/operations/ingest-email/route"

const signedInAs = (organizationId: string, permissions: string[]) => {
  tenant.current = { tenantId: organizationId, organizationId, userId: `user-${organizationId}`, email: "", role: "member", teamId: null }
  tenant.permissions = permissions
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`https://app.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  })

const newCapa = { title: "T", description: "D", category: "Process", priority: "Low", assignedTo: "someone" }

beforeEach(() => {
  tenant.current = null
  tenant.permissions = []
  whatsapp.send.mockClear()
  intake.ingest.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("anonymous callers are refused", () => {
  it.each([
    ["whatsapp send", () => whatsappRoute.POST(post("/api/v1/crm/whatsapp", { to: "+14155550100", body: "x" }))],
    ["capa create", () => capaRoute.POST(post("/api/v1/capa", newCapa))],
    ["capa list", () => capaRoute.GET(new NextRequest("https://app.test/api/v1/capa"))],
    ["rag search", () => ragRoute.POST(post("/api/v1/rag", { action: "search", query: "x" }))],
    ["enterprise scoring", () => enterpriseRoute.POST(post("/api/v1/enterprise", { action: "digit-score" }))],
    ["enterprise webhook", () => enterpriseRoute.POST(post("/api/v1/enterprise", { action: "webhook", url: "https://example.com", event: "e" }))],
  ])("%s returns 401", async (_name, call) => {
    expect((await call()).status).toBe(401)
    expect(whatsapp.send).not.toHaveBeenCalled()
  })
})

describe("permissions are enforced", () => {
  it("allows a WhatsApp send with crm:write, a permission that exists in production", async () => {
    signedInAs("org-a", ["crm:write"])
    const res = await whatsappRoute.POST(post("/api/v1/crm/whatsapp", { to: "+14155550100", body: "x" }))
    expect(res.status).toBe(200)
    expect(whatsapp.send).toHaveBeenCalledOnce()
  })

  it("blocks a WhatsApp send without crm:write", async () => {
    signedInAs("org-a", ["crm:read"])
    const res = await whatsappRoute.POST(post("/api/v1/crm/whatsapp", { to: "+14155550100", body: "x" }))
    expect(res.status).toBe(403)
    expect(whatsapp.send).not.toHaveBeenCalled()
  })

  it("does not let analytics:read send webhooks", async () => {
    signedInAs("org-a", ["analytics:read"])
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const res = await enterpriseRoute.POST(post("/api/v1/enterprise", { action: "webhook", url: "https://example.com", event: "e" }))
    expect(res.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("webhook SSRF protection", () => {
  it.each(["http://169.254.169.254/latest/meta-data/", "http://127.0.0.1:5432/", "http://10.0.0.1/", "file:///etc/passwd"])(
    "refuses %s",
    async (url) => {
      signedInAs("org-a", ["integrations:write"])
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)
      const res = await enterpriseRoute.POST(post("/api/v1/enterprise", { action: "webhook", url, event: "e" }))
      expect(res.status).toBe(400)
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )
})

describe("tenant isolation", () => {
  it("ignores a spoofed organizationId and hides CAPAs from other orgs", async () => {
    signedInAs("org-a", ["capas:write", "capas:read"])
    const created = await (await capaRoute.POST(post("/api/v1/capa", { ...newCapa, organizationId: "org-b", createdBy: "forged" }))).json()
    expect(created.organizationId).toBe("org-a")
    expect(created.createdBy).toBe("user-org-a")

    signedInAs("org-b", ["capas:write", "capas:read"])
    const list = await (await capaRoute.GET(new NextRequest("https://app.test/api/v1/capa?organizationId=org-a"))).json()
    expect(list).toEqual([])

    const put = await capaRoute.PUT(
      new NextRequest("https://app.test/api/v1/capa", {
        method: "PUT",
        body: JSON.stringify({ capaId: created.id, toState: "Investigation" }),
      }),
    )
    expect(put.status).toBe(404)
  })

  it("does not return another org's RAG documents", async () => {
    const secret = "zebrafinancialsecretphrase"
    signedInAs("org-a", ["documents:create"])
    expect((await ragRoute.POST(post("/api/v1/rag", { action: "index", content: `Quarterly note: ${secret}` }))).status).toBe(200)

    const own = await (await ragRoute.POST(post("/api/v1/rag", { action: "search", query: secret }))).json()
    expect(JSON.stringify(own.results)).toContain(secret)

    signedInAs("org-b", ["documents:create"])
    const other = await (await ragRoute.POST(post("/api/v1/rag", { action: "search", query: secret }))).json()
    expect(other.results).toEqual([])
  })
})

describe("inbound email secret", () => {
  const email = { from: "a@example.com", subject: "s", text: "body" }

  beforeEach(() => {
    vi.stubEnv("DEFAULT_OPERATIONS_ORG_ID", "org-a")
  })

  it("fails closed when no secret is configured", async () => {
    vi.stubEnv("INBOUND_EMAIL_SECRET", "")
    const res = await ingestRoute.POST(post("/api/v1/operations/ingest-email?token=anything", email))
    expect(res.status).toBe(401)
    expect(intake.ingest).not.toHaveBeenCalled()
  })

  it("rejects a wrong secret", async () => {
    vi.stubEnv("INBOUND_EMAIL_SECRET", "right-secret")
    const res = await ingestRoute.POST(post("/api/v1/operations/ingest-email?token=wrong", email))
    expect(res.status).toBe(401)
    expect(intake.ingest).not.toHaveBeenCalled()
  })

  it.each([
    ["query token", "?token=right-secret", {}],
    ["bearer header", "", { authorization: "Bearer right-secret" }],
  ])("accepts the secret via %s", async (_name, query, headers) => {
    vi.stubEnv("INBOUND_EMAIL_SECRET", "right-secret")
    const res = await ingestRoute.POST(post(`/api/v1/operations/ingest-email${query}`, email, headers))
    expect(res.status).toBe(200)
    expect(intake.ingest).toHaveBeenCalledOnce()
  })
})
