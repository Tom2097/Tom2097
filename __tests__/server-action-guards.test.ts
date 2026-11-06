// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const state = vi.hoisted(() => ({
  sessionUser: null as null | { id: string },
  inserts: [] as Array<{ table: string; row: Record<string, unknown> }>,
  updates: [] as string[],
  memberCount: 0,
  callerRole: null as null | string,
}))

vi.mock("@/lib/auth/server-auth", () => ({
  getAuthenticatedUser: async () => {
    if (!state.sessionUser) throw new Error("Unauthorized")
    return state.sessionUser
  },
}))
vi.mock("@/lib/auth/audit", () => ({ getClientIp: () => "203.0.113.7" }))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/logging", () => ({ logger: { logInfo: vi.fn(), logError: vi.fn() } }))
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {}
      const self = () => chain
      for (const method of ["select", "eq", "neq", "in", "order"]) chain[method] = self
      chain.update = () => {
        state.updates.push(table)
        return chain
      }
      chain.maybeSingle = async () => ({
        data: table === "organization_members" ? { role: state.callerRole } : { organization_id: "org-1" },
      })
      chain.single = async () => ({ data: { id: "approval-1", organization_id: "org-1", requested_role: "admin", user_id: "target" } })
      chain.insert = (row: Record<string, unknown>) => {
        state.inserts.push({ table, row })
        const inserted = Promise.resolve({ error: null }) as Promise<{ error: null }> & Record<string, unknown>
        inserted.select = () => ({ single: async () => ({ data: { id: "approval-1" }, error: null }) })
        return inserted
      }
      chain.then = (resolve: (v: unknown) => unknown) => resolve({ count: state.memberCount, data: [{ id: "pending-1" }] })
      return chain
    },
  }),
}))

import { logAuditEvent } from "@/lib/audit-logging"
import {
  getPendingRoleApprovals,
  processRoleApproval,
  requestRoleApproval,
  roleRequiresApproval,
} from "@/lib/company/role-approval"
import { guardQuery } from "@/lib/analytics/text-to-sql"

beforeEach(() => {
  state.sessionUser = null
  state.inserts = []
  state.updates = []
  state.memberCount = 0
  state.callerRole = null
})

describe("logAuditEvent", () => {
  it("does not write to the audit table without a session", async () => {
    await logAuditEvent("11111111-1111-1111-1111-111111111111", "onboarding", "identity_verified")
    expect(state.inserts).toEqual([])
  })

  it("records the session user, not the claimed id, using real columns", async () => {
    state.sessionUser = { id: "real-user" }
    await logAuditEvent("forged-user", "onboarding", "stage_1_started", { stage: "identity" })

    expect(state.inserts).toHaveLength(1)
    const { table, row } = state.inserts[0]
    expect(table).toBe("audit_logs")
    expect(row).toEqual({
      user_id: "real-user",
      organization_id: "org-1",
      action: "stage_1_started",
      resource_type: "onboarding",
      metadata: { stage: "identity", client_reported: true },
      ip_address: "203.0.113.7",
    })
  })

  it("drops oversized metadata", async () => {
    state.sessionUser = { id: "real-user" }
    await logAuditEvent("x", "onboarding", "big", { blob: "a".repeat(9000) })
    expect(state.inserts[0].row.metadata).toEqual({ truncated: true, client_reported: true })
  })
})

describe("role approval", () => {
  it("refuses a request made for someone else", async () => {
    state.sessionUser = { id: "attacker" }
    state.memberCount = 5
    expect(await requestRoleApproval("victim", "org-1", "admin")).toEqual({ success: false })
    expect(state.inserts).toEqual([])
  })

  it("refuses an anonymous request", async () => {
    state.memberCount = 5
    expect(await requestRoleApproval("anyone", "org-1", "owner")).toEqual({ success: false })
    expect(state.inserts).toEqual([])
  })

  it("lets a member request a role for themselves", async () => {
    state.sessionUser = { id: "member" }
    state.memberCount = 5
    expect(await requestRoleApproval("member", "org-1", "admin")).toEqual({ success: true, approvalId: "approval-1" })
  })

  it("refuses an approval claiming to be another user", async () => {
    state.sessionUser = { id: "attacker" }
    state.callerRole = "owner"
    expect(await processRoleApproval("approval-1", "real-owner", "approve")).toEqual({ success: false })
    expect(state.updates).toEqual([])
  })

  it("hides pending requests from anonymous users and non-admins", async () => {
    expect(await getPendingRoleApprovals("org-1")).toEqual([])
    state.sessionUser = { id: "member" }
    state.callerRole = "member"
    expect(await getPendingRoleApprovals("org-1")).toEqual([])
    state.callerRole = "admin"
    expect(await getPendingRoleApprovals("org-1")).toEqual([{ id: "pending-1" }])
  })

  it("keeps pre-login onboarding working by answering false", async () => {
    state.memberCount = 5
    expect(await roleRequiresApproval("draft-id", "", "admin")).toBe(false)
  })
})

describe("guardQuery", () => {
  const org = "organization_id = 'org-1'"

  it.each([
    `SELECT id, email FROM profiles WHERE ${org}`,
    `SELECT * FROM auth.users -- organizations ${org}`,
    `SELECT * FROM pg_shadow /* documents */ WHERE ${org}`,
    `SELECT pg_read_file('/etc/passwd') FROM documents WHERE ${org}`,
    `SELECT 1 FROM vault.decrypted_secrets, documents WHERE ${org}`,
    `SELECT * FROM documents, api_keys WHERE ${org}`,
    `SELECT * FROM documents JOIN api_keys ON true WHERE ${org}`,
    `SELECT * FROM (SELECT * FROM api_keys) x WHERE ${org}`,
    `WITH t AS (SELECT * FROM api_keys) SELECT * FROM t WHERE ${org}`,
    `SELECT * FROM documents WHERE ${org} UNION SELECT * FROM api_keys`,
    `SELECT * FROM documents WHERE ${org} UNION TABLE api_keys`,
    `SELECT * FROM documents WHERE ${org}; DROP TABLE documents`,
    `SELECT * INTO stolen FROM documents WHERE ${org}`,
    `SELECT query_to_xml('select * from api_keys', true, true, '') FROM documents WHERE ${org}`,
    `SELECT * FROM "api_keys" WHERE ${org}`,
    `SELECT * FROM generate_series(1, 2) WHERE ${org}`,
    "SELECT * FROM documents",
    "DELETE FROM documents",
  ])("rejects %s", (sql) => {
    expect(guardQuery(sql).allowed).toBe(false)
  })

  it.each([
    `SELECT COUNT(*) FROM documents WHERE ${org}`,
    `SELECT * FROM crm_deals WHERE ${org} LIMIT 100;`,
    `SELECT d.title, c.name FROM crm_deals d JOIN crm_contacts c ON c.id = d.owner_id WHERE d.${org}`,
    `SELECT EXTRACT(month FROM created_at) AS m, COUNT(*) FROM documents WHERE ${org} GROUP BY 1`,
    `WITH recent AS (SELECT * FROM documents WHERE ${org}) SELECT COUNT(*) FROM recent`,
    `SELECT * FROM documents WHERE ${org} AND name = 'drop table; -- not sql'`,
    `SELECT updated_at FROM assets WHERE ${org}`,
  ])("allows %s", (sql) => {
    expect(guardQuery(sql).allowed).toBe(true)
  })
})
