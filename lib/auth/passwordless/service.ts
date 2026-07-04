import { randomBytes, createHash } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/service"
import { DEFAULT_PASSWORDLESS_CONFIG, PasswordlessError, PasswordlessErrorCode } from "./types"
import type { MagicLinkOptions, MagicLinkToken, PasswordlessConfig } from "./types"
import { logger } from "@/lib/logging"

function generateToken(): string {
  return randomBytes(32).toString("hex")
}

/** Hash a token for DB storage (only store hashed tokens). */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export async function sendMagicLink(
  options: MagicLinkOptions,
  config: PasswordlessConfig = DEFAULT_PASSWORDLESS_CONFIG,
): Promise<{ success: boolean }> {
  const db = createServiceClient()

  // Rate limit check: count tokens for this email in the last hour
  const since = new Date(Date.now() - config.rateLimitWindow * 60 * 1000).toISOString()
  const { count } = await db
    .from("magic_link_tokens")
    .select("*", { count: "exact", head: true })
    .eq("email", options.email.toLowerCase())
    .gte("created_at", since)

  if (count && count >= config.maxTokensPerHour) {
    throw new PasswordlessError(
      "Too many login attempts. Please try again later.",
      PasswordlessErrorCode.RATE_LIMITED,
    )
  }

  // Find or create user by email
  const { data: existingProfile } = await db
    .from("profiles")
    .select("id")
    .eq("email", options.email.toLowerCase())
    .maybeSingle()

  let userId: string
  if (existingProfile) {
    userId = existingProfile.id as string
  } else {
    const { data: newUser, error: signUpErr } = await db.auth.admin.createUser({
      email: options.email.toLowerCase(),
      email_confirm: true,
    })
    if (signUpErr || !newUser?.user) {
      throw new PasswordlessError("Failed to create user", PasswordlessErrorCode.EMAIL_SEND_FAILED)
    }
    userId = newUser.user.id
    await db.from("profiles").insert({ id: userId, email: options.email.toLowerCase() })
  }

  const rawToken = generateToken()
  const expiresAt = new Date(Date.now() + config.tokenExpiration * 60 * 1000)

  await db.from("magic_link_tokens").insert({
    user_id: userId,
    email: options.email.toLowerCase(),
    token_hash: hashToken(rawToken),
    expires_at: expiresAt.toISOString(),
    redirect_to: options.redirectTo ?? null,
    used: false,
  })

  const loginUrl = new URL("/api/auth/passwordless/verify", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
  loginUrl.searchParams.set("token", rawToken)
  loginUrl.searchParams.set("email", options.email.toLowerCase())

  const html = config.emailTemplate
    .replace("{{loginUrl}}", loginUrl.toString())
    .replace("{{expirationMinutes}}", String(config.tokenExpiration))

  // Best-effort email send via Resend or configured provider
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (apiKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: config.fromEmail,
          to: options.email.toLowerCase(),
          subject: options.customSubject || config.emailSubject,
          html,
        }),
      })
    } else {
      logger.logWarn("[passwordless] No RESEND_API_KEY set; would send email", { email: options.email, url: loginUrl.toString() })
    }
  } catch (err) {
    logger.logError("[passwordless] Email send failed:", { error: err })
    throw new PasswordlessError("Failed to send email", PasswordlessErrorCode.EMAIL_SEND_FAILED)
  }

  return { success: true }
}

export async function verifyMagicLink(
  token: string,
  email: string,
): Promise<string | null> {
  const db = createServiceClient()
  const tokenHash = hashToken(token)

  const { data: record } = await db
    .from("magic_link_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .eq("email", email.toLowerCase())
    .eq("used", false)
    .maybeSingle()

  if (!record) return null

  const expiresAt = new Date(record.expires_at as string)
  if (expiresAt < new Date()) return null

  await db.from("magic_link_tokens").update({ used: true, used_at: new Date().toISOString() }).eq("id", record.id)

  return record.user_id as string
}
