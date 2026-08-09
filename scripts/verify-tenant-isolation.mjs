#!/usr/bin/env node
/**
 * Automated proof of the architecture wiring-brief's "hard gate" tenant
 * isolation test: "from Tenant A's session, attempt to read Tenant B's data
 * by ID. It must fail. Automate this test. 'It looks isolated' is not
 * isolation."
 *
 * This is a live integration test against the real Supabase project, not
 * part of `npm test` (that suite is pure-mocked unit tests -- proving real
 * Postgres RLS enforcement under a real signed-in JWT needs a real
 * database and a real auth session, which a mock can't verify). Run
 * manually, e.g. before go-live or after any RLS-policy change:
 *
 *   node scripts/verify-tenant-isolation.mjs
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY,
 * and NEXT_PUBLIC_SUPABASE_ANON_KEY in the environment. Creates two disposable
 * test orgs + one disposable test user, all deleted again before exit
 * (including on failure) -- never touches real tenant data.
 */
import { createClient } from "@supabase/supabase-js"
import crypto from "node:crypto"

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !serviceKey || !anonKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY in the environment.")
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

let orgAId, orgBId, userAId, contactBId

async function cleanup() {
  if (contactBId) await admin.from("crm_contacts").delete().eq("id", contactBId)
  if (userAId) await admin.from("profiles").delete().eq("id", userAId)
  if (userAId) await admin.auth.admin.deleteUser(userAId).catch(() => {})
  if (orgAId) await admin.from("organizations").delete().eq("id", orgAId)
  if (orgBId) await admin.from("organizations").delete().eq("id", orgBId)
}

async function fail(message) {
  console.error(`\nFAIL: ${message}`)
  await cleanup()
  process.exit(1)
}

async function main() {
  console.log("Setting up two disposable, isolated test tenants...")

  const { data: orgA, error: orgAErr } = await admin.from("organizations").insert({ name: "__isolation_test_org_a__" }).select("id").single()
  if (orgAErr || !orgA) return fail(`could not create test org A: ${orgAErr?.message}`)
  orgAId = orgA.id

  const { data: orgB, error: orgBErr } = await admin.from("organizations").insert({ name: "__isolation_test_org_b__" }).select("id").single()
  if (orgBErr || !orgB) return fail(`could not create test org B: ${orgBErr?.message}`)
  orgBId = orgB.id

  const testEmail = `isolation-test-${Date.now()}@example.invalid`
  const testPassword = `Test-${crypto.randomUUID()}!`

  const { data: userA, error: userAErr } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  })
  if (userAErr || !userA?.user) return fail(`could not create test user: ${userAErr?.message}`)
  userAId = userA.user.id

  // auth.users has an on_auth_user_created trigger that already inserted a
  // profiles row for this id (with no organization) -- update it rather
  // than insert, or this collides with the trigger's own row.
  const { error: profileErr } = await admin
    .from("profiles")
    .update({ organization_id: orgAId, role: "owner" })
    .eq("id", userAId)
  if (profileErr) return fail(`could not set up test profile: ${profileErr.message}`)

  const { data: contactB, error: contactBErr } = await admin
    .from("crm_contacts")
    .insert({ organization_id: orgBId, first_name: "Isolation", last_name: "TestContact", status: "lead" })
    .select("id")
    .single()
  if (contactBErr || !contactB) return fail(`could not seed Tenant B's data: ${contactBErr?.message}`)
  contactBId = contactB.id

  console.log("Signing in as Tenant A's real user (anon-key client, RLS-bound -- not service role)...")
  const anonClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: signInErr } = await anonClient.auth.signInWithPassword({ email: testEmail, password: testPassword })
  if (signInErr) return fail(`could not sign in as test user: ${signInErr.message}`)

  console.log("Attempting to read Tenant B's contact from Tenant A's session (this must return nothing)...")
  const { data: leaked, error: readErr } = await anonClient
    .from("crm_contacts")
    .select("id")
    .eq("id", contactBId)
    .maybeSingle()

  if (leaked) {
    return fail(
      `TENANT ISOLATION BREACH -- Tenant A's session successfully read Tenant B's contact (id=${leaked.id}). ` +
      `RLS is not enforcing organization_id scoping on crm_contacts. Do not ship until this is fixed.`,
    )
  }

  console.log(`PASS -- cross-tenant read correctly returned no data${readErr ? ` (RLS error: ${readErr.message})` : " (empty result)"}.`)
  console.log("Cleaning up test data...")
  await cleanup()
  console.log("\nTenant isolation verified: RLS genuinely blocks cross-tenant reads.")
}

main().catch(async (err) => {
  console.error("Unexpected error during isolation test:", err)
  await cleanup()
  process.exit(1)
})
